import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
const tar = require('tar-stream');

const HOST = "storage.googleapis.com";
const BASE_PATH = "reproto-releases"

function getPlatform(): string {
    switch (process.platform) {
        case "linux":
            return "linux";
        case "darwin":
            return "osx";
        case "win32":
            return "windows";
        default:
            throw new Error(`unsupported platform: ${process.platform}`);
    }
}

function getArch(): string {
    switch (process.arch) {
        case "x64":
            return "x86_64";
        default:
            throw new Error(`unsupported arch: ${process.arch}`);
    }
}

function getExe(platform: string) {
    switch (platform) {
        case "windows":
            return "reproto.exe";
        default:
           return "reproto";
    }
}

function get(path: string): Thenable<string> {
    return new Promise((resolve, reject) => {
        https.get({host: HOST, path: path}, function(response) {
            var body = '';

            response.on('data', (d) => {
                body += d;
            });

            response.on('error', reject);

            response.on('end', () => {
                resolve(body);
            });
        });
    });
}

async function getVersion(): Promise<string> {
    return get(`/${BASE_PATH}/releases`).then(body => {
        const parts = body.split('\n');

        if (parts.length <= 0) {
            throw new Error(`not a release: ${body}`);
        }

        return parts[0].trim();
    });
}

function makeDirs(test: string) {
    let queue = [];
    let p = test;

    while (true) {
        if (fs.existsSync(p)) {
            break;
        }

        queue.push(p);
        p = path.dirname(p);

        if (!p) {
            throw new Error(`not a path: ${test}`);
        }
    }

    queue.reverse();

    for (let v of queue) {
        fs.mkdirSync(v);
    }
}

/**
 * Install reproto.
 */
export async function install(out: vscode.OutputChannel): Promise<void> {
    const home = process.env.HOME;

    if (!home) {
        throw new Error("HOME: not an environment variable");
    }

    const dataHome = process.env.XDG_DATA_HOME || path.join(home, ".local", "share");
    const binHome = path.join(home, ".local", "bin");

    const platform = getPlatform();
    const arch = getArch();
    const version = await getVersion();
    const exe = getExe(platform);

    const tuple = `${version}-${platform}-${arch}`;

    out.appendLine(`install: detected tuple: ${tuple}`);

    const versioned = `reproto-${tuple}`;
    const releases = path.join(dataHome, 'releases');
    const archive = path.join(releases, `${versioned}.tar.gz`);
    const bin = path.join(binHome, exe);

    makeDirs(releases);
    makeDirs(binHome);

    if (!fs.existsSync(archive)) {
        out.appendLine(`install: downloading: ${archive}`)

        await new Promise((resolve, reject) => {
            https.get({host: HOST, path: `/${BASE_PATH}/${versioned}.tar.gz`}, response => {
                if (!response.statusCode) {
                    reject(new Error(`no status code in response`));
                    return;
                }

                if (response.statusCode / 100 != 2) {
                    reject(new Error(`bad status code: ${response.statusCode}`));
                    return;
                }

                let w = response.pipe(fs.createWriteStream(archive));

                w.on('finish', resolve);
                w.on('error', reject);
            });
        });
    }

    if (!fs.existsSync(bin)) {
        out.appendLine(`install: extracting: ${bin}`)

        var read = fs.createReadStream(archive);

        await new Promise((resolve, reject) => {
            var extract = tar.extract()

            extract.on('entry', (header: any, stream: fs.ReadStream, next: any) => {
                if (header.name != exe) {
                    throw new Error(`rogue file in archive: ${header.name}`);
                }

                var binStream = fs.createWriteStream(bin);
        
                let w = stream.pipe(binStream);

                w.on('finish', () => {
                    binStream.close();
                    out.appendLine(`Wrote binary: ${bin}`);
                    next()
                });
        
                stream.resume();
            });
        
            let w = read.pipe(zlib.createGunzip()).pipe(extract);

            w.on('finish', resolve);
            w.on('error', reject);
        });
    }

    fs.chmodSync(bin, 0o755);
    out.appendLine(`install: done!`)
}