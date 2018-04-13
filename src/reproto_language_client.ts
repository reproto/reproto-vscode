import { workspace, ExtensionContext, OutputChannel } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';

export function activate(
    cx: ExtensionContext,
    reproto: string,
    out: OutputChannel
) {
	let serverOptions: ServerOptions = {
		command : reproto,
		args: ["language-server"],
		options: {
			env: {
				"RUST_BACKTRACE": "1"
			}
		}
	}

	let clientOptions: LanguageClientOptions = {
		documentSelector: ['reproto'],
		synchronize: {
			configurationSection: 'reproto',
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	}

	let client = new LanguageClient('reproto', serverOptions, clientOptions);
	let disposable = client.start();

	cx.subscriptions.push(disposable);
}