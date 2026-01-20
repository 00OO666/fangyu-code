import { logger } from '@/lib/logger';
import React, { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  toUserFriendlyError,
  type UserFriendlyError,
} from "@/lib/userFriendlyErrors";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Show detailed error info (for development) */
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  friendlyError: UserFriendlyError | null;
  showTechnicalDetails: boolean;
}

/**
 * ✅ Enhanced Error Boundary component to catch and display React rendering errors
 *
 * Features:
 * - Catches React rendering errors
 * - Supports custom fallback UI
 * - Optional error callback for logging/monitoring
 * - Built-in retry functionality
 * - User-friendly error messages with suggestions
 * - Recovery options
 *
 * _Requirements: 2.3_
 *
 * @example
 * <ErrorBoundary onError={(error) => logToMonitoring(error)}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      friendlyError: null,
      showTechnicalDetails: true, // 🔧 FIX: 默认展开技术详情
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    const friendlyError = toUserFriendlyError(error);
    return { hasError: true, error, friendlyError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console
    logger.error('ErrorBoundary', "Error caught by boundary:", error, errorInfo);

    // ✅ NEW: Call optional error handler (e.g., for monitoring/logging)
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      friendlyError: null,
      showTechnicalDetails: false,
    });
  };

  toggleTechnicalDetails = () => {
    this.setState((prev) => ({
      showTechnicalDetails: !prev.showTechnicalDetails,
    }));
  };

  render() {
    if (this.state.hasError && this.state.error && this.state.friendlyError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      const { friendlyError, showTechnicalDetails } = this.state;

      // Enhanced error UI with user-friendly messages
      return (
        <div className="flex items-center justify-center min-h-[200px] p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  {/* 用户友好的标题 */}
                  <h3 className="text-lg font-semibold">{friendlyError.title}</h3>

                  {/* 用户友好的描述 */}
                  <p className="text-sm text-muted-foreground">
                    {friendlyError.description}
                  </p>

                  {/* 建议解决方案 */}
                  {friendlyError.suggestions.length > 0 && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-md">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        建议：
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {friendlyError.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 mt-4">
                    {friendlyError.retryable && (
                      <Button onClick={this.reset} size="sm" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        重试
                      </Button>
                    )}
                    {!friendlyError.retryable && (
                      <Button onClick={this.reset} size="sm" variant="outline">
                        关闭
                      </Button>
                    )}
                  </div>

                  {/* 🔧 FIX: 始终显示完整的技术详情（包括堆栈） */}
                  {this.state.error && (
                    <div className="mt-4 pt-4 border-t">
                      <button
                        onClick={this.toggleTechnicalDetails}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showTechnicalDetails ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        技术详情
                      </button>
                      {showTechnicalDetails && (
                        <div className="mt-2 space-y-2">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">错误消息：</p>
                            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-20 whitespace-pre-wrap break-words">
                              {this.state.error.message}
                            </pre>
                          </div>
                          {this.state.error.stack && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">错误堆栈：</p>
                              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap break-words font-mono">
                                {this.state.error.stack}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
} 