import { readdir, readFileSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { TestCaseParser } from './Parser';

async function parseAllTestCases() {
    const testCasesDir = path.join(__dirname, 'test-cases');
    const files = await fs.readdir(testCasesDir);
    
    for (const file of files) {
        if (file.endsWith('.txt')) {
            try {
                console.log(`\nParsing ${file}:`);
                console.log('='.repeat(50));
                
                const filePath = path.join(testCasesDir, file);
                const messages = TestCaseParser.parseFile(filePath);
                
                console.log(JSON.stringify(messages, null, 2));
            } catch (error) {
                if (error instanceof Error) {
                    console.error(`Error parsing ${file}:`, error.message);
                } else {
                    console.error(`Unknown error parsing ${file}`);
                }
            }
        }
    }
}

parseAllTestCases().catch(console.error); 