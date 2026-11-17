export interface DropzoneFile {
    file: File
    thumbnail: string | null
    videoPreview: string | null
}

export interface DropzoneState {
    config: DropzoneConfigSnapshot;
    files: DropzoneFile[]
    folderPaths?: string[][]
    count: number
    totalSize: number
    draggingOver: boolean
    /** True from drop/picker intake start through completion, cancellation, or failure. */
    collecting: boolean
    disabled: boolean
}

export interface DropzoneError<TId extends string = string> {
    id: TId
    message: string
    metadata: {
        files: File[]
    } | null
}

export interface DropzoneAddResult {
    accepted: File[]
    errors: DropzoneError[]
}

export interface DropzoneConfigInputFields {
    accept?: string[]
    exclude?: string[]
    minSize?: number
    maxSize?: number
    maxFiles?: number
    maxTotalSize?: number
    multipleEnabled?: boolean
    openOnClickEnabled?: boolean
    disabled?: boolean
    dedupeEnabled?: boolean
    videoPreviewEnabled?: boolean
    imageThumbnailsEnabled?: boolean
    videoThumbnailsEnabled?: boolean
    audioThumbnailsEnabled?: boolean
    onChange?: (state: DropzoneState) => void
    onError?: (error: DropzoneError) => void
}

export interface DropzoneConfigFields extends Required<Omit<DropzoneConfigInputFields, 'accept' | 'exclude' | 'minSize' | 'maxSize' | 'maxFiles' | 'maxTotalSize' | 'onChange' | 'onError'>> {
    accept: DropzoneConfigInputFields['accept']
    exclude: DropzoneConfigInputFields['exclude']
    minSize: DropzoneConfigInputFields['minSize']
    maxSize: DropzoneConfigInputFields['maxSize']
    maxFiles: DropzoneConfigInputFields['maxFiles']
    maxTotalSize: DropzoneConfigInputFields['maxTotalSize']
    onChange: DropzoneConfigInputFields['onChange']
    onError: DropzoneConfigInputFields['onError']
}

export interface DropzoneOptions {
    element: HTMLElement
    config: DropzoneConfig
}

export interface DropzoneEngine {
    readonly config: DropzoneReactiveConfig
    getState(): DropzoneState
    subscribe(listener: (state: DropzoneState) => void): () => void
    addFiles(files: File | FileList | File[]): DropzoneAddResult
    removeFile(file: File): boolean
    clearFiles(): void
    replaceFile(oldFile: File, newFile: File): boolean
    getFileSize(file: File): {size: number; sizeFormatted: string}
    getFolderPath(file: File): string[]
    openFilePicker(): void
    openFolderPicker(): void
    createThumbnail(file: File): Promise<string | null>
    createVideoPreview(file: File): string | null
    destroy(): void
}

export type DropzoneConfig = {
    files?: {
        accept?: DropzoneConfigInputFields['accept'];
        exclude?: DropzoneConfigInputFields['exclude'];
        limits?: {
            minSize?: DropzoneConfigInputFields['minSize'];
            maxSize?: DropzoneConfigInputFields['maxSize'];
            maxFiles?: DropzoneConfigInputFields['maxFiles'];
            maxTotalSize?: DropzoneConfigInputFields['maxTotalSize'];
        };
        multiple?: {
            enabled?: DropzoneConfigInputFields['multipleEnabled'];
        };
        dedupe?: {
            enabled?: DropzoneConfigInputFields['dedupeEnabled'];
        };
    };
    picker?: {
        openOnClick?: {
            enabled?: DropzoneConfigInputFields['openOnClickEnabled'];
        };
    };
    enabled?: DropzoneConfigInputFields['disabled'];
    previews?: {
        video?: {
            enabled?: DropzoneConfigInputFields['videoPreviewEnabled'];
        };
    };
    thumbnails?: {
        image?: {
            enabled?: DropzoneConfigInputFields['imageThumbnailsEnabled'];
        };
        video?: {
            enabled?: DropzoneConfigInputFields['videoThumbnailsEnabled'];
        };
        audio?: {
            enabled?: DropzoneConfigInputFields['audioThumbnailsEnabled'];
        };
    };
    events?: {
        onChange?: DropzoneConfigInputFields['onChange'];
        onError?: DropzoneConfigInputFields['onError'];
    };
};

export interface DropzoneReactiveConfigFilesLimits {
    minSize?: DropzoneConfigFields['minSize'];
    maxSize?: DropzoneConfigFields['maxSize'];
    maxFiles?: DropzoneConfigFields['maxFiles'];
    maxTotalSize?: DropzoneConfigFields['maxTotalSize'];
}

export interface DropzoneReactiveConfigFilesMultiple {
    enabled: DropzoneConfigFields['multipleEnabled'];
}

export interface DropzoneReactiveConfigFilesDedupe {
    enabled: DropzoneConfigFields['dedupeEnabled'];
}

export interface DropzoneReactiveConfigFiles {
    accept?: DropzoneConfigFields['accept'];
    exclude?: DropzoneConfigFields['exclude'];
    get limits(): DropzoneReactiveConfigFilesLimits;
    set limits(value: {
        minSize?: DropzoneConfigInputFields['minSize'];
        maxSize?: DropzoneConfigInputFields['maxSize'];
        maxFiles?: DropzoneConfigInputFields['maxFiles'];
        maxTotalSize?: DropzoneConfigInputFields['maxTotalSize'];
    });
    get multiple(): DropzoneReactiveConfigFilesMultiple;
    set multiple(value: {
        enabled?: DropzoneConfigInputFields['multipleEnabled'];
    });
    get dedupe(): DropzoneReactiveConfigFilesDedupe;
    set dedupe(value: {
        enabled?: DropzoneConfigInputFields['dedupeEnabled'];
    });
}

export interface DropzoneReactiveConfigPickerOpenOnClick {
    enabled: DropzoneConfigFields['openOnClickEnabled'];
}

export interface DropzoneReactiveConfigPicker {
    get openOnClick(): DropzoneReactiveConfigPickerOpenOnClick;
    set openOnClick(value: {
        enabled?: DropzoneConfigInputFields['openOnClickEnabled'];
    });
}

export interface DropzoneReactiveConfigPreviewsVideo {
    enabled: DropzoneConfigFields['videoPreviewEnabled'];
}

export interface DropzoneReactiveConfigPreviews {
    get video(): DropzoneReactiveConfigPreviewsVideo;
    set video(value: {
        enabled?: DropzoneConfigInputFields['videoPreviewEnabled'];
    });
}

export interface DropzoneReactiveConfigThumbnailsImage {
    enabled: DropzoneConfigFields['imageThumbnailsEnabled'];
}

export interface DropzoneReactiveConfigThumbnailsVideo {
    enabled: DropzoneConfigFields['videoThumbnailsEnabled'];
}

export interface DropzoneReactiveConfigThumbnailsAudio {
    enabled: DropzoneConfigFields['audioThumbnailsEnabled'];
}

export interface DropzoneReactiveConfigThumbnails {
    get image(): DropzoneReactiveConfigThumbnailsImage;
    set image(value: {
        enabled?: DropzoneConfigInputFields['imageThumbnailsEnabled'];
    });
    get video(): DropzoneReactiveConfigThumbnailsVideo;
    set video(value: {
        enabled?: DropzoneConfigInputFields['videoThumbnailsEnabled'];
    });
    get audio(): DropzoneReactiveConfigThumbnailsAudio;
    set audio(value: {
        enabled?: DropzoneConfigInputFields['audioThumbnailsEnabled'];
    });
}

export interface DropzoneReactiveConfigEvents {
    onChange?: DropzoneConfigFields['onChange'];
    onError?: DropzoneConfigFields['onError'];
}

export interface DropzoneReactiveConfig {
    get files(): DropzoneReactiveConfigFiles;
    set files(value: {
        accept?: DropzoneConfigInputFields['accept'];
        exclude?: DropzoneConfigInputFields['exclude'];
        limits?: {
            minSize?: DropzoneConfigInputFields['minSize'];
            maxSize?: DropzoneConfigInputFields['maxSize'];
            maxFiles?: DropzoneConfigInputFields['maxFiles'];
            maxTotalSize?: DropzoneConfigInputFields['maxTotalSize'];
        };
        multiple?: {
            enabled?: DropzoneConfigInputFields['multipleEnabled'];
        };
        dedupe?: {
            enabled?: DropzoneConfigInputFields['dedupeEnabled'];
        };
    });
    get picker(): DropzoneReactiveConfigPicker;
    set picker(value: {
        openOnClick?: {
            enabled?: DropzoneConfigInputFields['openOnClickEnabled'];
        };
    });
    enabled: DropzoneConfigFields['disabled'];
    get previews(): DropzoneReactiveConfigPreviews;
    set previews(value: {
        video?: {
            enabled?: DropzoneConfigInputFields['videoPreviewEnabled'];
        };
    });
    get thumbnails(): DropzoneReactiveConfigThumbnails;
    set thumbnails(value: {
        image?: {
            enabled?: DropzoneConfigInputFields['imageThumbnailsEnabled'];
        };
        video?: {
            enabled?: DropzoneConfigInputFields['videoThumbnailsEnabled'];
        };
        audio?: {
            enabled?: DropzoneConfigInputFields['audioThumbnailsEnabled'];
        };
    });
    get events(): DropzoneReactiveConfigEvents;
    set events(value: {
        onChange?: DropzoneConfigInputFields['onChange'];
        onError?: DropzoneConfigInputFields['onError'];
    });
}

export type DropzoneConfigSnapshot = Readonly<Omit<DropzoneReactiveConfig, 'events' | 'document' | 'source' | 'src' | 'sources'>>;
