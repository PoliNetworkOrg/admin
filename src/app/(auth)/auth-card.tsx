import { Logo } from "@/components/logo"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Check, CheckCircle2, CircleArrowRight, CircleDashed, Clock } from "lucide-react"
import { PropsWithChildren } from "react"

type Type = "signup" | "login"
type Props = PropsWithChildren<{
  type: Type
  stage: number
}>

export const MaxStage: Record<Type, number> = {
  login: 2,
  signup: 4,
}

export function AuthCard(props: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="flex p-2 justify-center gap-4 items-center">
        <Logo className="size-12 md:size-14" />
        <h2 className="text-2xl">
          <span className="font-bold">PoliNetwork</span> Auth
        </h2>
      </div>
      <DesktopCard {...props} />
      <MobileCard {...props} />
    </div>
  )
}

function DesktopCard(props: Props) {
  return (
    <Card className="flex min-w-[min(60rem,95vw)] min-h-[min(70rem,60vh)] bg-background max-md:hidden">
      <div className="grow max-w-[min(20rem,40%)] flex flex-col justify-start items-center gap-2 p-7">
        {props.type === "login" && <LoginStages stage={props.stage} />}
        {props.type === "signup" && <SignupStages stage={props.stage} />}
      </div>
      <div className="grow bg-card rounded-lg m-2">{props.children}</div>
    </Card>
  )
}

function MobileCard(props: Props) {
  return (
    <div className="flex flex-col min-w-[min(50rem,80vw)] justify-center gap-4 items-center md:hidden">
      <Card className="flex w-full py-2 h-fit bg-background justify-center gap-4 items-center">
        <Logo size={48} />
        <h2 className="text-xl font-bold">Polinetwork Auth</h2>
      </Card>
      <Card className="flex w-full min-h-[min(140rem,50vh)] bg-card">{props.children}</Card>
    </div>
  )
}

function Stage({
  children,
  currentStage,
  activeStage,
}: PropsWithChildren<{ currentStage: number; activeStage: number }>) {
  return (
    <div
      className={cn(
        "flex w-full justify-start items-center gap-3 transition-all duration-250 text-lg",
        currentStage < activeStage ? "text-muted-foreground" : "",
        currentStage === activeStage ? "text-accent-foreground [&>svg]:size-8" : "",
        currentStage > activeStage ? "text-green-600" : ""
      )}
    >
      {currentStage < activeStage && <CircleDashed />}
      {currentStage === activeStage && <CircleArrowRight />}
      {currentStage > activeStage && <Check />}
      <p>{children}</p>
    </div>
  )
}

function LoginStages({ stage }: { stage: number }) {
  return (
    <div className="w-full grow flex flex-col gap-8">
      <h3 className="text-3xl">Login</h3>
      <div className="w-full grow flex flex-col gap-6">
        <Stage currentStage={stage} activeStage={0}>
          Insert Email
        </Stage>
        <Stage currentStage={stage} activeStage={1}>
          Authenticate
        </Stage>
      </div>
    </div>
  )
}

function SignupStages({ stage }: { stage: number }) {
  return (
    <div className="w-full grow flex flex-col gap-8">
      <h3 className="text-3xl font-bold text-accent-foreground">Signup</h3>
      <div className="w-full grow flex flex-col gap-6">
        <Stage currentStage={stage} activeStage={0}>
          Insert Email
        </Stage>
        <Stage currentStage={stage} activeStage={1}>
          Profile Setup
        </Stage>
        <Stage currentStage={stage} activeStage={2}>
          Review
        </Stage>
        <Stage currentStage={stage} activeStage={3}>
          Verification
        </Stage>
      </div>
    </div>
  )
}
