import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-[var(--shadow-lg)] group-[.toaster]:rounded-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md",
          success: "group-[.toaster]:!border-success/30 [&_[data-icon]]:!text-success",
          error: "group-[.toaster]:!border-destructive/30 [&_[data-icon]]:!text-destructive",
          warning: "group-[.toaster]:!border-warning/40 [&_[data-icon]]:!text-warning",
          info: "group-[.toaster]:!border-primary/30 [&_[data-icon]]:!text-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
