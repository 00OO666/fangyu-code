import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, List } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionScrollControlsProps {
  displayableMessagesCount: number;
  userScrolled: boolean;
  showPromptNavigator: boolean;
  parentRef: React.RefObject<HTMLDivElement>;
  sessionMessagesRef: React.RefObject<{ scrollToBottom: () => void }>;
  onSetUserScrolled: (scrolled: boolean) => void;
  onSetShouldAutoScroll: (should: boolean) => void;
  onShowPromptNavigator: () => void;
}

export const SessionScrollControls: React.FC<SessionScrollControlsProps> = React.memo(
  ({
    displayableMessagesCount,
    userScrolled,
    showPromptNavigator,
    parentRef,
    sessionMessagesRef,
    onSetUserScrolled,
    onSetShouldAutoScroll,
    onShowPromptNavigator,
  }) => {
    const { t } = useTranslation();

    if (displayableMessagesCount <= 5) {
      return null;
    }

    return (
      <div className="absolute right-4 bottom-4 pointer-events-auto z-40">
        <div className="flex flex-col gap-1.5">
          {/* Prompt Navigator Button */}
          {!showPromptNavigator && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-1 bg-background/60 backdrop-blur-md border border-border/50 rounded-xl px-1.5 py-2 cursor-pointer hover:bg-accent/80 shadow-sm"
              onClick={onShowPromptNavigator}
              title={t("claudeSession.promptNav")}
            >
              <List className="h-4 w-4" />
              <div className="flex flex-col items-center text-[10px] leading-tight tracking-wider">
                <span>{t("session.promptChar1")}</span>
                <span>{t("session.promptChar2")}</span>
                <span>{t("session.promptChar3")}</span>
              </div>
            </motion.div>
          )}

          {/* New Message Indicator */}
          <AnimatePresence>
            {userScrolled && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="flex flex-col items-center gap-1 bg-background/60 backdrop-blur-md border border-border/50 rounded-xl px-1.5 py-2 cursor-pointer hover:bg-accent/80 shadow-sm"
                onClick={() => {
                  onSetUserScrolled(false);
                  onSetShouldAutoScroll(true);
                  sessionMessagesRef.current?.scrollToBottom();
                }}
                title={t("claudeSession.newMessage")}
              >
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                <div className="flex flex-col items-center text-[10px] leading-tight tracking-wider">
                  <span>{t("session.newChar1")}</span>
                  <span>{t("session.newChar2")}</span>
                  <span>{t("session.newChar3")}</span>
                </div>
                <ChevronDown className="h-3 w-3" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scroll Up/Down Buttons */}
          <div className="flex flex-col bg-background/60 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSetUserScrolled(true);
                onSetShouldAutoScroll(false);
                if (parentRef.current) {
                  parentRef.current.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }
              }}
              className="px-1.5 py-1.5 hover:bg-accent/80 rounded-none h-auto min-h-0"
              title={t("claudeSession.scrollToTop")}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <div className="h-px w-full bg-border/50" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSetUserScrolled(false);
                onSetShouldAutoScroll(true);
                sessionMessagesRef.current?.scrollToBottom();
              }}
              className="px-1.5 py-1.5 hover:bg-accent/80 rounded-none h-auto min-h-0"
              title={t("claudeSession.scrollToBottom")}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
);
