<?php

namespace Workspace\PHPStan\Resources;

use FilesystemIterator;
use PHPStan\Analyser\ResultCache\ResultCacheValueExtension;

class ResourceDirectorySnapshot implements ResultCacheValueExtension
{
    public function getValue(string $key): string
    {
        if (! is_dir($key)) {
            return 'missing';
        }

        $entries = [];

        foreach (new FilesystemIterator($key, FilesystemIterator::SKIP_DOTS) as $entry) {
            $type = $entry->isLink() ? 'link' : ($entry->isDir() ? 'directory' : 'other');
            $entries[] = [$entry->getFilename(), $type];
        }

        sort($entries);

        return hash('sha256', serialize($entries));
    }

    public function keyToResultCache(string $key): string
    {
        return $key;
    }

    public function keyFromResultCache(string $storedKey): string
    {
        return $storedKey;
    }
}
