import { ExternalLinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { stripChatId } from "@/lib/utils/telegram"
import type { ApiOutput } from "@/server/trpc/types"

type Message = NonNullable<ApiOutput["tg"]["messages"]["getLastByUser"]["messages"]>[number]
export function MessageCard({ message: m }: { message: Message }) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p>
          <span className="text-muted-foreground">Chat: </span>
          {m.group && <span>{m.group.title}</span>} [{m.chatId}]
        </p>
        <p>
          <span className="text-muted-foreground">Message ID: </span>
          {m.messageId}
        </p>
        <p>
          <span className="text-muted-foreground">Timestamp: </span>
          {m.timestamp.toLocaleString()}
        </p>
        <span className="text-muted-foreground">Content:</span>
        <p className="pl-3" title={m.message}>
          {m.message.slice(0, 40)} {m.message.length >= 40 && "[...]"}
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {m.group?.inviteLink && (
          <a href={m.group.inviteLink} rel="noopener noreferral" target="_blank" aria-label="Join group">
            <Button variant="outline">
              <ExternalLinkIcon size={20} /> Join Chat
            </Button>
          </a>
        )}
        <a
          href={`https://t.me/c/${stripChatId(m.chatId)}/${m.messageId}`}
          rel="noopener noreferral"
          target="_blank"
          aria-label="Open message in chat"
        >
          <Button variant="outline">
            <ExternalLinkIcon size={20} /> Open
          </Button>
        </a>
      </CardFooter>
    </Card>
  )
}
