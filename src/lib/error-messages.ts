import { isAppError, type AppError, type AppErrorCode } from "@/lib/errors";

export type ToastType = "default" | "error" | "success" | "info";

type ToastMessage = {
  title: string;
  description?: string;
  type?: ToastType;
};

const APP_ERROR_MESSAGES: Partial<Record<AppErrorCode, ToastMessage>> = {
  NOTE_NOT_FOUND: {
    title: "Note not found",
    description: "This note no longer exists or you do not have access.",
  },
  BLOCK_NOT_FOUND: {
    title: "Block not found",
    description: "This block no longer exists or you do not have access.",
  },
  RANK_EXHAUSTED: {
    title: "Ordering conflict",
    description: "Please retry your action.",
  },
  FORBIDDEN: {
    title: "Action not allowed",
    description: "You do not have permission to do that.",
  },
  VALIDATION_ERROR: {
    title: "Invalid input",
    description: "Please check your input and try again.",
  },
};

const DEFAULT_APP_ERROR_MESSAGE: ToastMessage = {
  title: "Request failed",
  description: "Please try again.",
  type: "error",
};

export function toToastMessage(error: unknown): ToastMessage {
  if (isAppError(error)) {
    const message = APP_ERROR_MESSAGES[error.code] ?? DEFAULT_APP_ERROR_MESSAGE;
    return { ...message, type: message.type ?? "error" };
  }

  if (error instanceof Error) {
    return {
      title: "Something went wrong",
      description: error.message || "Please try again.",
      type: "error",
    };
  }

  return {
    title: "Something went wrong",
    description: "Please try again.",
    type: "error",
  };
}

export type { AppError };
