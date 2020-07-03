import { spawn, ExecFileOptions } from "child_process";
import { OutputChannel } from "vscode";

export class Reproto {
    readonly path: string;
    readonly rootPath?: string;

    constructor(path: string, rootPath?: string) {
        this.path = path;
        this.rootPath = rootPath;
    }

    /**
     * Execute the given command, and log output to the given channel.
     */
    private executeLogged(
        args: string[],
        out: OutputChannel
    ): Promise<void> {
        out.show();

        return new Promise((resolve, reject) => {
            const opts: ExecFileOptions = { cwd: this.rootPath };

            const c = spawn(this.path, args, opts);

            let buffer = "";

            c.stdout.on("data", (data: string) => {
                buffer += data;

                while (true) {
                    const index = buffer.indexOf('\n');

                    if (index < 0) {
                        break;
                    }

                    let json = buffer.substring(0, index);
                    buffer = buffer.substring(index + 1);

                    try {
                        json = JSON.parse(json);
                    } catch (e) {
                        c.emit('error', new Error(`illegal json on stdout: ${e}`));
                        continue;
                    }

                    c.emit('json', json);
                }
            });

            c.on('json', (json: any) => {
                if (json["type"] === "log") {
                    out.appendLine(json["level"] + ": " + json["message"]);
                }
            });

            c.on("error", reject);

            c.on("close", (code) => {
                if (code !== 0) {
                    reject(new Error(`command exited with non-zero exit status: ${code}`));
                } else {
                    if (out) {
                        resolve();
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    /**
     * Execute the given command and capture stdout.
     *
     * @param command Command to execute.
     */
    private execute(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const opts: ExecFileOptions = { cwd: this.rootPath };

            const c = spawn(this.path, args, opts);

            let buffer = "";

            c.stdout.on("data", (data: string) => {
                buffer += data;
                c.emit("buffer");
            });

            c.on("close", (code: number) => {
                if (code !== 0) {
                    reject(new Error(`command exited with non-zero exit status: ${code}`));
                } else {
                    resolve(buffer);
                }
            });
        });
    }

    /**
     * Run `reproto --version` do determine which version it is.
     */
    version(): Promise<string> {
        return this.execute(["--version"]).then(out => out.trim());
    }

    init(out: OutputChannel): Promise<void> {
        return this.executeLogged(["--output-format", "json", "init"], out);
    }

    toString(): string {
        return this.path;
    }
}