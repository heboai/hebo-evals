import { TestCaseParser } from './Parser';

try {
    const messages = TestCaseParser.parseFile('./test_case.txt');
    console.log('Parsed messages:');
    console.log(JSON.stringify(messages, null, 2));
} catch (error: unknown) {
    if (error instanceof Error) {
        console.error('Error parsing file:', error.message);
    } else {
        console.error('Unknown error occurred');
    }
} 