/**
 * SpecWorkflowPanel - Spec 工作流面板组件
 *
 * 显示 Spec 工作流状态、任务进度
 *
 * Requirements: 5.5
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  CheckCircle,
  Circle,
  PlayCircle,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";

// =============================================================================
// 类型定义
// =============================================================================

type TaskStatus = "not_started" | "in_progress" | "completed" | "failed";
type SpecPhase = "requirements" | "design" | "tasks" | "implementation";

interface SpecTask {
  id: string;
  title: string;
  status: TaskStatus;
  isOptional?: boolean;
  subtasks?: SpecTask[];
  requirements?: string[];
}

interface SpecInfo {
  name: string;
  phase: SpecPhase;
  tasks: SpecTask[];
  createdAt: number;
  updatedAt: number;
}

interface SpecWorkflowPanelProps {
  spec?: SpecInfo;
  onTaskClick?: (taskId: string) => void;
  onStartTask?: (taskId: string) => void;
  onCompleteTask?: (taskId: string) => void;
}

// =============================================================================
// 辅助组件
// =============================================================================

const PhaseIndicator: React.FC<{ phase: SpecPhase; currentPhase: SpecPhase }> = ({
  phase,
  currentPhase,
}) => {
  const phases: SpecPhase[] = ["requirements", "design", "tasks", "implementation"];
  const currentIndex = phases.indexOf(currentPhase);
  const phaseIndex = phases.indexOf(phase);

  const isCompleted = phaseIndex < currentIndex;
  const isCurrent = phaseIndex === currentIndex;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isCompleted
            ? "bg-green-500 text-white"
            : isCurrent
              ? "bg-blue-500 text-white"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {isCompleted ? (
          <CheckCircle className="w-5 h-5" />
        ) : isCurrent ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </div>
      <span
        className={`text-sm font-medium capitalize ${
          isCurrent ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {phase}
      </span>
    </div>
  );
};

const TaskStatusIcon: React.FC<{ status: TaskStatus }> = ({ status }) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "in_progress":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case "failed":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Circle className="w-4 h-4 text-muted-foreground" />;
  }
};

// =============================================================================
// 任务项组件
// =============================================================================

const TaskItem: React.FC<{
  task: SpecTask;
  depth?: number;
  onTaskClick?: (taskId: string) => void;
  onStartTask?: (taskId: string) => void;
  onCompleteTask?: (taskId: string) => void;
}> = ({ task, depth = 0, onTaskClick, onStartTask, onCompleteTask }) => {
  const [expanded, setExpanded] = useState(true);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  const completedSubtasks = task.subtasks?.filter((t) => t.status === "completed").length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer ${
          depth > 0 ? "ml-6" : ""
        }`}
        onClick={() => onTaskClick?.(task.id)}
      >
        {hasSubtasks && (
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        )}

        {!hasSubtasks && <div className="w-6" />}

        <TaskStatusIcon status={task.status} />

        <span
          className={`flex-1 text-sm ${
            task.status === "completed" ? "line-through text-muted-foreground" : ""
          }`}
        >
          {task.title}
        </span>

        {task.isOptional && (
          <Badge variant="outline" className="text-xs">
            Optional
          </Badge>
        )}

        {hasSubtasks && (
          <span className="text-xs text-muted-foreground">
            {completedSubtasks}/{totalSubtasks}
          </span>
        )}

        {task.status === "not_started" && onStartTask && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6"
            onClick={(e) => {
              e.stopPropagation();
              onStartTask(task.id);
            }}
          >
            <PlayCircle className="w-4 h-4" />
          </Button>
        )}

        {task.status === "in_progress" && onCompleteTask && (
          <Checkbox
            checked={false}
            onCheckedChange={() => onCompleteTask(task.id)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {hasSubtasks && expanded && (
        <div className="space-y-1">
          {task.subtasks!.map((subtask) => (
            <TaskItem
              key={subtask.id}
              task={subtask}
              depth={depth + 1}
              onTaskClick={onTaskClick}
              onStartTask={onStartTask}
              onCompleteTask={onCompleteTask}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// 主组件
// =============================================================================

export const SpecWorkflowPanel: React.FC<SpecWorkflowPanelProps> = ({
  spec,
  onTaskClick,
  onStartTask,
  onCompleteTask,
}) => {
  if (!spec) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No spec loaded</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create or open a spec to see the workflow
          </p>
        </CardContent>
      </Card>
    );
  }

  // 计算进度
  const countTasks = (tasks: SpecTask[]): { total: number; completed: number } => {
    let total = 0;
    let completed = 0;

    for (const task of tasks) {
      if (task.subtasks && task.subtasks.length > 0) {
        const sub = countTasks(task.subtasks);
        total += sub.total;
        completed += sub.completed;
      } else {
        total++;
        if (task.status === "completed") completed++;
      }
    }

    return { total, completed };
  };

  const { total, completed } = countTasks(spec.tasks);
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Spec 信息 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{spec.name}</CardTitle>
            <Badge variant="outline" className="capitalize">
              {spec.phase}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* 阶段指示器 */}
          <div className="flex items-center justify-between mb-4">
            {(["requirements", "design", "tasks", "implementation"] as SpecPhase[]).map(
              (phase, index, arr) => (
                <React.Fragment key={phase}>
                  <PhaseIndicator phase={phase} currentPhase={spec.phase} />
                  {index < arr.length - 1 && <div className="flex-1 h-0.5 bg-muted mx-2" />}
                </React.Fragment>
              )
            )}
          </div>

          {/* 进度条 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{completed} completed</span>
              <span>{total - completed} remaining</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 任务列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] px-4 pb-4">
            <div className="space-y-1">
              {spec.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onTaskClick={onTaskClick}
                  onStartTask={onStartTask}
                  onCompleteTask={onCompleteTask}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 时间信息 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Created {new Date(spec.createdAt).toLocaleDateString()}
        </span>
        <span>Updated {new Date(spec.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

export default SpecWorkflowPanel;
