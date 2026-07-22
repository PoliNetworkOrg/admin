import type { IconType } from "react-icons"
import {
  FiBookOpen,
  FiCheckSquare,
  FiClipboard,
  FiCpu,
  FiEdit3,
  FiHelpCircle,
  FiLayout,
  FiMoreHorizontal,
  FiShield,
  FiUsers,
} from "react-icons/fi"
import { Card } from "@/components/ui/card"

export function WhatIs() {
  return (
    <div className="text-foreground w-full">
      <div className="text-primary flex items-center space-x-2 py-2 dark:text-white">
        <FiHelpCircle size={28} className="" />
        <h3 className="text-xl font-bold">What is this?</h3>
      </div>
      <p>
        This is a PoliNetwork&apos;s internal tool that allows admins and department staff to perform multiple actions
        via an easy web interface.
      </p>
      <p>What actions you can perform depends on your role, but some remarkable ones are:</p>
      <div className="xs:grid-cols-2 grid grid-cols-1 flex-wrap gap-4 py-2 md:grid-cols-3 lg:flex">
        <FeatureBox icon={FiBookOpen} feature="Group list" />
        <FeatureBox icon={FiUsers} feature="User list" />
        <FeatureBox icon={FiEdit3} feature="Update homepage" />
        <FeatureBox icon={FiCheckSquare} feature="Ban user everywhere" />
        <FeatureBox icon={FiClipboard} feature="Global audit log" />
        <FeatureBox icon={FiCpu} feature="Manage Telegram bot" />
        <FeatureBox icon={FiShield} feature="Spam bypass message " />
        <FeatureBox icon={FiLayout} feature="Internal assoc tools" />
        <FeatureBox icon={FiMoreHorizontal} feature="Many others" />
      </div>
      <p className="text-muted-foreground text-xs italic">
        It&apos;s clear that you&apos;ll have access to different features depending on your role(s).
      </p>
    </div>
  )
}

export function FeatureBox({ icon: Icon, feature }: { icon: IconType; feature: string }) {
  return (
    <Card className="h-36 w-full md:h-28 lg:w-36">
      <div className="grid h-full grid-cols-1 grid-rows-[1fr_1fr] gap-y-2">
        <Icon size={28} className="place-self-end justify-self-center" />
        <p className="mx-auto max-w-26 text-center text-base md:text-sm">{feature}</p>
      </div>
    </Card>
  )
}
