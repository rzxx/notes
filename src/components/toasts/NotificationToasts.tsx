"use client";

import * as React from "react";
import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";
import type { ToastType } from "@/lib/error-messages";

const TOAST_VARIANTS: Record<ToastType, { root: string; title: string; description: string }> = {
  default: {
    root: "border-stone-200 bg-stone-50 text-stone-900",
    title: "text-stone-900",
    description: "text-stone-700",
  },
  error: {
    root: "border-red-200 bg-red-50 text-red-950",
    title: "text-red-950",
    description: "text-red-800",
  },
  success: {
    root: "border-emerald-200 bg-emerald-50 text-emerald-950",
    title: "text-emerald-950",
    description: "text-emerald-800",
  },
  info: {
    root: "border-sky-200 bg-sky-50 text-sky-950",
    title: "text-sky-950",
    description: "text-sky-800",
  },
};

export function NotificationToasts() {
  const { toasts } = Toast.useToastManager();

  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed top-auto right-4 bottom-4 z-10 mx-auto flex w-65 sm:right-8 sm:bottom-8 sm:w-[320px]">
        {toasts.map((toast) => {
          const toastType = ((toast.data as { type?: ToastType } | undefined)?.type ??
            "default") as ToastType;
          const variant = TOAST_VARIANTS[toastType] ?? TOAST_VARIANTS.default;

          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              className={`absolute right-0 bottom-0 left-auto z-[calc(1000-var(--toast-index))] mr-0 h-(--height) w-full origin-bottom transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] rounded-lg border bg-clip-padding p-4 shadow-lg select-none [--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))] [transition:transform_0.5s_cubic-bezier(0.22,1,0.36,1),opacity_0.5s,height_0.15s] after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-[''] data-ending-style:opacity-0 data-expanded:h-(--toast-height) data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))] data-limited:opacity-0 data-starting-style:transform-[translateY(150%)] data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))] data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))] data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))] data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))] ${variant.root}`}
            >
              <Toast.Content className="relative overflow-hidden transition-opacity duration-250 data-behind:pointer-events-none data-behind:opacity-0 data-expanded:pointer-events-auto data-expanded:opacity-100">
                <Toast.Title className={`leading-5 font-medium ${variant.title}`} />
                <Toast.Description className={`text-sm leading-5 ${variant.description}`} />
                <Toast.Close
                  className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded border-none bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Toast.Close>
              </Toast.Content>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
