export interface ExecutionConfig {
  outputFormat: string;
  threshold: number;
  useSemanticScoring: boolean;
  // Define the properties needed for execution configuration
  taskType: string;
  parameters: Record<string, any>;
}

export interface ExecutionResult {
  // Define the properties for the result of an execution
  success: boolean;
  output: any;
  error?: string;
}