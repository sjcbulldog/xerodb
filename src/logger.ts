export interface StreamOptions {
    /**
     * Output stream for writing log lines.
     */
    write(str: string): void;
}

let loggerStream : StreamOptions | null = null ;

export function xeroDBLoggerInit(stream: StreamOptions) {
    loggerStream = stream ;
}

export function xeroDBLoggerLog(type: string, msg: string) {
    if (loggerStream !== null) {
        loggerStream.write(Date() + ':' + type + ':' + msg);
    }
}