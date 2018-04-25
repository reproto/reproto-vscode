import { workspace, ExtensionContext, OutputChannel, WorkspaceConfiguration } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';

export function activate(
	cx: ExtensionContext,
	config: WorkspaceConfiguration,
	reproto: string,
	out: OutputChannel
) {
	let args = ["language-server"];

	if (config.get<boolean>("debug")) {
		args.push("--debug");
		out.appendLine("reproto.debug: debug enabled")
	}

	var log = config.get<string>("log");

	if (log) {
		args.push("--log");
		args.push(log);
		out.appendLine(`reproto.log: logging to: ${log}`)
	}

	let serverOptions: ServerOptions = {
		command: reproto,
		args: args,
		options: {
			env: {
				"RUST_BACKTRACE": "1"
			}
		}
	};

	let clientOptions: LanguageClientOptions = {
		documentSelector: ['reproto'],
		synchronize: {
			configurationSection: 'reproto',
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	let client = new LanguageClient(
		'reproto',
		serverOptions,
		clientOptions
	);

	cx.subscriptions.push(client.start());
}