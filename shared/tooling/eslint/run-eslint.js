#!/usr/bin/env node

import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { clearLine, cursorTo } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseArgs, styleText } from 'node:util';
import { ESLint } from 'eslint';

const progressStream = process.stderr;
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let progressMessage = '';
let progressFrame = 0;
let progressTimer;

function renderProgress() {
    const line = `${spinnerFrames[progressFrame++ % spinnerFrames.length]} ${progressMessage}`;

    cursorTo(progressStream, 0);
    clearLine(progressStream, 0);
    progressStream.write(line.slice(0, Math.max(1, (progressStream.columns || 80) - 1)));
}

function showProgress(message) {
    progressMessage = message;

    if (!progressStream.isTTY) {
        progressStream.write(`${message}\n`);
        return;
    }

    renderProgress();
    progressTimer ??= setInterval(renderProgress, 100);
    progressTimer.unref();
}

function stopProgress() {
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = undefined;
        cursorTo(progressStream, 0);
        clearLine(progressStream, 0);
    }
}

function showPriorityProgress(completed, total, activity) {
    const filled = total === 0 ? 16 : Math.floor(completed / total * 16);

    showProgress(`ESLint [${'█'.repeat(filled)}${'░'.repeat(16 - filled)}] ${completed}/${total} priorities · ${activity}`);
}

function reportStyle(style, text) {
    return process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb'
        ? styleText(style, text, { validateStream: false }) : text;
}

function countLabel(count, label) {
    return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function formatDiagnostic(message) {
    const indentation = '  ';
    const width = Math.max(1, (process.stdout.columns || 80) - indentation.length - 1);
    const lines = [];

    // Wrap uncolored message text so ANSI color sequences do not consume width.
    // Preserve explicit line breaks and split oversized words without truncation.
    for (const paragraph of message.split(/\r?\n/u)) {
        let remaining = Array.from(paragraph);

        while (remaining.length > width) {
            const space = remaining.lastIndexOf(' ', width);
            const boundary = space > 0 ? space : width;

            lines.push(remaining.slice(0, boundary).join(''));
            remaining = remaining.slice(boundary + (space > 0 ? 1 : 0));
        }

        lines.push(remaining.join(''));
    }

    return lines.map((line) => `${indentation}${line}`);
}

async function run() {
    const workspaceDirectory = fileURLToPath(new URL('../../../', import.meta.url));
    const { values } = parseArgs({
        options: {
            file: { type: 'string' },
            folder: { type: 'string' },
        },
    });

    if (values.file !== undefined && values.folder !== undefined) {
        throw new TypeError('Use either --file or --folder in one run.');
    }

    const selectedPath = values.file ?? values.folder;
    let target = workspaceDirectory;

    if (selectedPath !== undefined) {
        if (selectedPath === '') {
            throw new TypeError('Provide a nonempty path for --file or --folder.');
        }

        target = resolve(selectedPath);
        const entry = statSync(target);

        if (values.file !== undefined && !entry.isFile()) {
            throw new TypeError(`The --file target must be a file. Received ${target}`);
        }

        if (values.folder !== undefined && !entry.isDirectory()) {
            throw new TypeError(`The --folder target must be a folder. Received ${target}`);
        }
    }

    const targets = [target];
    const configUrl = import.meta.resolve('#eslint/eslint.config.js');

    showProgress('Loading and validating ESLint rules…');

    const { priorities, createPassConfig } = await import(configUrl);
    const pendingChecks = new Map();
    let completedPriorities = 0;

    // Apply custom rules in priority order.
    for (const pass of priorities) {
        showPriorityProgress(completedPriorities, priorities.length, `Fixing P${pass}`);
        const overrideConfig = createPassConfig(pass);
        const eslint = new ESLint({ cwd: workspaceDirectory, overrideConfigFile: true, overrideConfig: overrideConfig, fix: true });
        const results = await eslint.lintFiles(targets);

        await ESLint.outputFixes(results);

        for (const result of results) {
            // Retain files for unresolved-rule and parser diagnostics.
            const ruleIds = pendingChecks.get(result.filePath) ?? new Set();

            for (const message of result.messages) {
                ruleIds.add(message.ruleId);
            }

            if (ruleIds.size > 0) pendingChecks.set(result.filePath, ruleIds);
        }

        completedPriorities++;
    }

    showPriorityProgress(completedPriorities, priorities.length, 'Fix passes complete');

    if (pendingChecks.size === 0) {
        stopProgress();
        progressStream.write('ESLint complete: no remaining violations.\n');
        process.exitCode = 0;
        return;
    }

    // Recheck unresolved custom rule/file pairs.
    // Later priorities intentionally refine earlier cleanup, such as restoring
    // blank lines, so do not rerun every earlier rule against the final layout.
    showProgress('Collecting remaining violations…');
    const overrideConfig = createPassConfig();
    const finalResults = [];
    let reportedFiles = 0;

    for (const [filePath, ruleIds] of pendingChecks) {
        showProgress(`Collecting remaining violations · file ${reportedFiles + 1}/${pendingChecks.size}`);
        const eslint = new ESLint({
            cwd: workspaceDirectory,
            overrideConfigFile: true,
            overrideConfig: overrideConfig,
            fix: false,
            ruleFilter({ ruleId }) {
                return ruleIds.has(ruleId);
            },
        });
        finalResults.push(...await eslint.lintFiles([filePath]));
        reportedFiles++;
    }

    const groups = new Map();
    const affectedFiles = new Set();
    let errorCount = 0;
    let warningCount = 0;

    for (const result of finalResults) {
        errorCount += result.errorCount;
        warningCount += result.warningCount;

        for (const message of result.messages) {
            const severity = message.fatal || message.severity === 2 ? 'error' : 'warning';
            const ruleId = message.ruleId ?? null;
            const group = groups.get(ruleId) ?? { errors: 0, warnings: 0, messages: new Map() };
            const messageKey = `${severity}\0${message.message}`;
            const entry = group.messages.get(messageKey) ?? { severity, text: message.message, locations: [] };

            entry.locations.push(`${result.filePath}:${message.line || 1}:${message.column || 1}`);
            group.messages.set(messageKey, entry);
            if (severity === 'error') group.errors++;
            else group.warnings++;
            groups.set(ruleId, group);
            affectedFiles.add(result.filePath);
        }
    }

    stopProgress();

    if (groups.size > 0) {
        const output = [];
        const separator = reportStyle('dim', '─'.repeat(Math.min(72, Math.max(1, (process.stdout.columns || 80) - 1))));

        for (const [ruleId, group] of groups) {
            const title = ruleId ? ruleId.split('/').at(-1).replaceAll('-', ' ').toUpperCase() : 'ESLINT DIAGNOSTICS';
            const counts = [];

            if (group.errors) counts.push(reportStyle('red', countLabel(group.errors, 'error')));
            if (group.warnings) counts.push(reportStyle('yellow', countLabel(group.warnings, 'warning')));
            output.push(`${reportStyle('bold', title)} · ${counts.join(' · ')}`);
            if (ruleId) output.push(reportStyle('dim', ruleId));
            output.push('');

            // Deduplicate only exact messages. Keep every location and all
            // guidance intact rather than guessing which sentences to remove.
            for (const entry of group.messages.values()) {
                output.push(...formatDiagnostic(entry.text), '');
                for (const location of entry.locations) output.push(`  ${location}`);
                output.push('');
            }

            output.push(separator, '');
        }

        const ruleCount = [...groups.keys()].filter((ruleId) => ruleId !== null).length;

        output.push(reportStyle('bold', [
            countLabel(errorCount, 'error'),
            countLabel(warningCount, 'warning'),
            countLabel(ruleCount, 'rule'),
            countLabel(affectedFiles.size, 'file'),
        ].join(' · ')));
        process.stdout.write(`${output.join('\n')}\n`);
    } else {
        progressStream.write('ESLint complete: no remaining violations.\n');
    }

    process.exitCode = errorCount > 0 ? 1 : 0;
}

try {
    await run();
} catch (error) {
    stopProgress();
    console.error(error);
    process.exitCode = 2;
} finally {
    stopProgress();
}
