import { readFileSync } from 'fs';
import path from 'path';

// Types for different message types
type ActorType = 'user' | 'assistant' | 'human_agent';

interface BaseMessage {
    type: ActorType | 'tool_use' | 'tool_response';
    content: string;
}

interface ActorMessage extends BaseMessage {
    type: ActorType;
}

interface ToolUseMessage extends BaseMessage {
    type: 'tool_use';
    tool: string;
    args: Record<string, any>;
}

interface ToolResponseMessage extends BaseMessage {
    type: 'tool_response';
}

type Message = ActorMessage | ToolUseMessage | ToolResponseMessage;

class TestCaseParser {
    private static MESSAGE_REGEX = /^(user|assistant|human_agent|tool use|tool response):(.+?)(?=(?:user|assistant|human_agent|tool use|tool response):|$)/gims;
    private static TOOL_USE_REGEX = /^tool use:\s*(\w+)\s*args:\s*({[\s\S]+})/i;

    public static parseFile(filePath: string): Message[] {
        try {
            // Resolve the full path
            const fullPath = path.resolve(filePath);
            
            // Read the file content
            const fileContent = readFileSync(fullPath, 'utf-8');
            
            // Parse the content
            return this.parse(fileContent);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to parse file ${filePath}: ${error.message}`);
            }
            throw error;
        }
    }

    public static parse(content: string): Message[] {
        const messages: Message[] = [];
        const matches = content.matchAll(this.MESSAGE_REGEX);

        for (const match of matches) {
            const [_, type, content] = match;
            const trimmedContent = content.trim();

            switch (type.toLowerCase()) {
                case 'user':
                case 'assistant':
                case 'human_agent':
                    messages.push({
                        type: type.toLowerCase() as ActorType,
                        content: trimmedContent
                    });
                    break;

                case 'tool use':
                    const toolMatch = trimmedContent.match(this.TOOL_USE_REGEX);
                    if (toolMatch) {
                        const [_, toolName, argsStr] = toolMatch;
                        try {
                            const args = JSON.parse(argsStr);
                            messages.push({
                                type: 'tool_use',
                                tool: toolName,
                                args,
                                content: trimmedContent
                            });
                        } catch (e) {
                            throw new Error(`Invalid tool args JSON: ${argsStr}`);
                        }
                    }
                    break;

                case 'tool response':
                    messages.push({
                        type: 'tool_response',
                        content: trimmedContent
                    });
                    break;
            }
        }

        const mergedMessages = this.mergeConsecutiveMessages(messages);
        this.validateMessageSequence(mergedMessages);
        return mergedMessages;
    }

    private static mergeConsecutiveMessages(messages: Message[]): Message[] {
        const merged: Message[] = [];
        let currentBlock: Message | null = null;

        for (const message of messages) {
            if (!currentBlock) {
                currentBlock = message;
                continue;
            }

            if (currentBlock.type === message.type && 
                ['user', 'assistant', 'human_agent'].includes(message.type)) {
                currentBlock.content += '\n\n' + message.content;
            } else {
                merged.push(currentBlock);
                currentBlock = message;
            }
        }

        if (currentBlock) {
            merged.push(currentBlock);
        }

        return merged;
    }

    private static validateMessageSequence(messages: Message[]): void {
        // Validate that the sequence follows the rules
        for (let i = 0; i < messages.length; i++) {
            const current = messages[i];
            const next = messages[i + 1];

            if (current.type === 'tool_use' && next?.type !== 'tool_response') {
                throw new Error('Tool use must be followed by tool response');
            }

            if (current.type === 'tool_response' && next?.type !== 'assistant') {
                throw new Error('Tool response must be followed by assistant message');
            }
        }

        // Validate last message is from assistant
        if (messages.length > 0 && messages[messages.length - 1].type !== 'assistant') {
            throw new Error('Last message must be from assistant');
        }
    }
}

export { TestCaseParser, Message, ActorMessage, ToolUseMessage, ToolResponseMessage };
