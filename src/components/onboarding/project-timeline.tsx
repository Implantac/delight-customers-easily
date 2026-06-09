import { motion } from "framer-motion";
import { Check, Circle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description: string;
  status: "completed" | "current" | "upcoming" | "late";
  date?: string;
}

interface ProjectTimelineProps {
  steps: Step[];
}

export function ProjectTimeline({ steps }: ProjectTimelineProps) {
  return (
    <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
      {steps.map((step, index) => (
        <div key={step.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          {/* Icon */}
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors duration-300",
            step.status === "completed" && "bg-emerald-500 border-emerald-600 text-white",
            step.status === "current" && "bg-primary border-primary text-primary-foreground",
            step.status === "late" && "bg-rose-500 border-rose-600 text-white"
          )}>
            {step.status === "completed" ? (
              <Check className="w-5 h-5" />
            ) : step.status === "current" ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Circle className="w-5 h-5 fill-current" />
              </motion.div>
            ) : step.status === "late" ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5 text-muted-foreground" />
            )}
          </div>

          {/* Card */}
          <div className="w-[calc(100%-4rem)] md:w-[45%] p-4 rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all shadow-sm">
            <div className="flex items-center justify-between space-x-2 mb-1">
              <div className="font-bold text-sm text-foreground">{step.title}</div>
              {step.date && <time className="font-mono text-[10px] text-muted-foreground uppercase">{step.date}</time>}
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">{step.description}</div>
            
            {step.status === "current" && (
              <div className="mt-3 flex gap-2">
                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "65%" }}
                    className="h-full bg-primary"
                  />
                </div>
                <span className="text-[10px] font-bold text-primary">65%</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
