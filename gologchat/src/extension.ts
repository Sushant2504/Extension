// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('GoLogChat extension activated');

	const helloWorld = vscode.commands.registerCommand('gologchat.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from GoLogChat!');
	});

	const logPrompt = vscode.commands.registerCommand('gologchat.logPrompt', async () => {
		const config = getConfig();

		if (!config.enableLogging) {
			vscode.window.showInformationMessage('GoLogChat logging is disabled in settings.');
			return;
		}

		if (!config.apiUrl || !config.developerId || !config.teamId) {
			vscode.window.showErrorMessage('GoLogChat: Please set apiUrl, developerId, and teamId in settings.');
			return;
		}

		const promptText = await vscode.window.showInputBox({
			title: 'GoLogChat: Prompt',
			placeHolder: 'Enter the prompt you sent to the AI assistant',
			ignoreFocusOut: true,
		});

		if (!promptText) {
			return;
		}

		const responseText = await vscode.window.showInputBox({
			title: 'GoLogChat: Response (optional)',
			placeHolder: 'Enter the AI response (optional)',
			ignoreFocusOut: true,
		});

		try {
			await sendPrompt({
				apiUrl: config.apiUrl,
				developerId: config.developerId,
				teamId: config.teamId,
				isAdmin: config.isAdmin,
				prompt: promptText,
				response: responseText,
			});
			vscode.window.showInformationMessage('GoLogChat: Prompt logged successfully.');
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			vscode.window.showErrorMessage(`GoLogChat failed to log prompt: ${message}`);
		}
	});

	context.subscriptions.push(helloWorld, logPrompt);
}

// This method is called when your extension is deactivated
export function deactivate() {}

type PromptPayload = {
	apiUrl: string;
	developerId: string;
	teamId: string;
	isAdmin: boolean;
	prompt: string;
	response?: string;
};

type ExtensionConfig = {
	apiUrl: string;
	developerId?: string;
	teamId?: string;
	enableLogging: boolean;
	isAdmin: boolean;
};

function getConfig(): ExtensionConfig {
	const config = vscode.workspace.getConfiguration('gologchat');

	return {
		apiUrl: config.get<string>('apiUrl', 'http://localhost:8080'),
		developerId: config.get<string>('developerId'),
		teamId: config.get<string>('teamId'),
		enableLogging: config.get<boolean>('enableLogging', true),
		isAdmin: config.get<boolean>('isAdmin', false),
	};
}

async function sendPrompt(payload: PromptPayload): Promise<void> {
	const trimmedApiUrl = payload.apiUrl.replace(/\/+$/, '');
	const url = `${trimmedApiUrl}/api/prompts`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Developer-ID': payload.developerId,
			'X-Team-ID': payload.teamId,
			'X-Is-Admin': String(payload.isAdmin),
		},
		body: JSON.stringify({
			prompt: payload.prompt,
			response: payload.response,
			developerId: payload.developerId,
			teamId: payload.teamId,
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `Request failed with status ${response.status}`);
	}
}
