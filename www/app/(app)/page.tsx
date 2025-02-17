"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { useEffect, useState, useRef } from "react"
import { useCallback } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { Textarea } from "@/components/ui/textarea"
import {
  Globe,
  Paperclip,
  Plus,
  Send,
  CircleDotDashed
} from "lucide-react"
import type { Message, ChatState } from '@/types/chat'
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSubCategorySidebar } from "@/components/sidebar/sub-category-sidebar"
import { useCategorySidebar } from "@/components/sidebar/category-sidebar"

interface UseAutoResizeTextareaProps {
  minHeight: number
  maxHeight?: number
}

const MIN_HEIGHT = 48
const MAX_HEIGHT = 164

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current
      if (!textarea) return

      if (reset) {
        textarea.style.height = `${minHeight}px`
        return
      }

      textarea.style.height = `${minHeight}px`
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      )

      textarea.style.height = `${newHeight}px`
    },
    [minHeight, maxHeight]
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = `${minHeight}px`
    }
  }, [minHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [adjustHeight])

  return { textareaRef, adjustHeight }
}

const AnimatedPlaceholder = ({ showSearch, showResearch }: { showSearch: boolean, showResearch: boolean }) => (
  <AnimatePresence mode="wait">
    <motion.p
      key={showSearch ? "search" : "ask"}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.1 }}
      className="pointer-events-none absolute w-[150px] text-sm text-muted-foreground"
    >
      {showSearch ? "Search the web..." : showResearch ? "Show Thinking..." : "Ask Friday..."}
    </motion.p>
  </AnimatePresence>
)

function AiInput() {
  const {
    categorySidebarState,
  } = useCategorySidebar();
  const {
    subCategorySidebarState,
  } = useSubCategorySidebar();

  const [value, setValue] = useState("")
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
  })
  const [showSearch, setShowSearch] = useState(false)
  const [showResearch, setShowReSearch] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add chat state management
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
  })
  const [conversationHistory, setConversationHistory] = useState<string>('')

  const handelClose = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    if (fileInputRef.current) {
      fileInputRef.current.value = "" // Reset file input
    }
    setImagePreview(null) // Use null instead of empty string
  }

  // Removed empty interface FileChangeEvent as it is equivalent to React.ChangeEvent<HTMLInputElement>

  const handelChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file: File | null = e.target.files ? e.target.files[0] : null
    if (file) {
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async () => {
    if (!value.trim()) return

    const userMessage: Message = {
      role: 'user',
      content: value.trim(),
    }

    // Update conversation history
    const contextWindow = 3;
    const conversations = conversationHistory.split('\n')
      .slice(-contextWindow * 4)
      .join('\n');

    const newHistory = conversations +
      `\nHuman: ${value.trim()}\nAssistant:`;

    setConversationHistory(newHistory);

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: null,
    }))

    setValue("")
    adjustHeight(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newHistory
        }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
      }

      setConversationHistory(newHistory + ` ${data.response}\n`)
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
      }))
    } catch {
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to get response from AI',
      }))
    }
  }

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  return (
<div className={cn(
  "flex flex-col h-full relative transition-[left,right,width,margin-right] duration-200 ease-linear",
  subCategorySidebarState === "expanded" ? "mr-64" : 
  categorySidebarState === "expanded" ? "mr-64" : ""
)}>
  {/* Messages display area - fills available space */}
      <ScrollArea className="flex-1 z-10 mb-[110px]">
        <div className="w-1/2 mx-auto space-y-4 pb-4">
          {chatState.messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-1 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-2 ${message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                  }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {chatState.isLoading && (
            <div className="flex gap-1">
              <div className="rounded-lg bg-muted p-2">
                Thinking...
              </div>
            </div>
          )}
          {chatState.error && (
            <div className="p-2 text-center text-destructive">
              {chatState.error}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area - fixed at bottom */}
      <div className="absolute bottom-2 w-1/2 left-1/2 translate-x-[-50%] z-20 rounded-2xl bg-transparent">
        <div className="w-full">
          <div className="relative flex flex-col rounded-2xl border bg-primary-foreground">
            <div
              style={{ maxHeight: `${MAX_HEIGHT}px` }}
            >
              <div className="relative">
                <Textarea
                  id="ai-input"
                  value={value}
                  placeholder=""
                  className="w-full resize-none rounded-2xl rounded-b-none border-none px-4 py-3 leading-[1.2] focus-visible:ring-0 "
                  ref={textareaRef}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  onChange={(e) => {
                    setValue(e.target.value)
                    adjustHeight()
                  }}
                />
                {!value && (
                  <div className="absolute left-4 top-3">
                    <AnimatedPlaceholder showResearch={showResearch} showSearch={showSearch} />
                  </div>
                )}
              </div>
            </div>

            <div className="h-12 rounded-b-xl">
              <div className="absolute bottom-3 left-3 flex items-center gap-1">
                <label
                  className={cn(
                    "relative cursor-pointer rounded-full p-2",
                    imagePreview
                      ? "border bg-background text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handelChange}
                    className="hidden"
                  />
                  <Paperclip
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-colors hover:text-primary",
                      imagePreview && "text-primary"
                    )}
                  />
                  {imagePreview && (
                    <div className="absolute bottom-[105px] left-0 h-[50px] w-[50px]">
                      <Image
                        className="rounded-lg object-cover"
                        src={imagePreview || "/picture1.jpeg"}
                        height={500}
                        width={500}
                        alt="additional image"
                      />
                      <button
                        onClick={handelClose}
                        className="shadow-3xl absolute -left-2 -top-2 rotate-45 rounded-lg"
                      >
                        <Plus className="h-6 w-6" />
                      </button>
                    </div>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowSearch(!showSearch)
                  }}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-full border px-2 py-0.5 transition-all",
                    showSearch
                      ? "border bg-background text-muted-foreground hover:text-primary"
                      : "border-transparent"
                  )}
                >
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                    <motion.div
                      animate={{
                        rotate: showSearch ? 180 : 0,
                        scale: showSearch ? 1.1 : 1,
                      }}
                      whileHover={{
                        rotate: showSearch ? 180 : 15,
                        scale: 1.1,
                        transition: {
                          type: "spring",
                          stiffness: 300,
                          damping: 10,
                        },
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 25,
                      }}
                    >
                      <Globe
                        className={cn(
                          "h-4 w-4 text-muted-foreground hover:text-primary",
                          showSearch ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {showSearch && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{
                          width: "auto",
                          opacity: 1,
                        }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0 overflow-hidden whitespace-nowrap text-[11px] text-primary"
                      >
                        Search
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReSearch(!showResearch)
                  }}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-full border px-1.5 py-1 transition-all",
                    showResearch
                      ? "border bg-background text-muted-foreground hover:text-primary"
                      : "border-transparent"
                  )}
                >
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                    <motion.div
                      animate={{
                        rotate: showResearch ? 180 : 0,
                        scale: showResearch ? 1.1 : 1,
                      }}
                      whileHover={{
                        rotate: showResearch ? 180 : 15,
                        scale: 1.1,
                        transition: {
                          type: "spring",
                          stiffness: 300,
                          damping: 10,
                        },
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 25,
                      }}
                    >
                      <CircleDotDashed
                        className={cn(
                          "h-4 w-4 text-muted-foreground hover:text-primary",
                          showResearch ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {showResearch && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{
                          width: "auto",
                          opacity: 1,
                        }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0 overflow-hidden whitespace-nowrap text-[11px] text-primary"
                      >
                        Research
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
              <div className="absolute bottom-3 right-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className={cn(
                    "rounded-full p-2 text-muted-foreground transition-colors hover:text-primary",
                    value
                      ? " text-primary"
                      : " text-muted-foreground    "
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return <AiInput />
}
