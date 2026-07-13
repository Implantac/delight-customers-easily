import { Moon, Sun, Monitor, Sparkles } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Alternar tema">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0 use-sistemas:rotate-90 use-sistemas:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 use-sistemas:rotate-0 use-sistemas:scale-0" />
          <Sparkles className="absolute h-4 w-4 rotate-90 scale-0 transition-all use-sistemas:rotate-0 use-sistemas:scale-100 text-amber-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}><Sun className="mr-2 h-4 w-4" />Enterprise Light {theme === "light" && "✓"}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}><Moon className="mr-2 h-4 w-4" />Enterprise Dark {theme === "dark" && "✓"}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("use-sistemas")}><Sparkles className="mr-2 h-4 w-4 text-amber-500" />USE CRM {theme === "use-sistemas" && "✓"}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}><Monitor className="mr-2 h-4 w-4" />Sistema {theme === "system" && "✓"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
