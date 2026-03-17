const isProduction = process.env.NODE_ENV === "production";

export const logger = {
  error(context: string, error: unknown): void {
    if (isProduction) {
      console.error(
        `[${context}]`,
        error instanceof Error ? error.message : "Internal error",
      );
    } else {
      console.error(`[${context}]`, error);
    }
  },
  warn(context: string, message: string): void {
    console.warn(`[${context}]`, message);
  },
};
