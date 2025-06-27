import { Card } from "@/components/ui/card";
import {
  type LucideIcon,
  BookOpen,
  Bot,
  CircleEllipsis,
  ClipboardList,
  Gavel,
  HelpCircle,
  LayoutTemplate,
  PencilLine,
  ShieldCheck,
  Users,
} from "lucide-react";

export function WhatIs() {
  return (
    <div className="text-foreground w-full">
      <div className="flex items-center space-x-2 py-2 text-primary dark:text-white">
        <HelpCircle size={28} className="" />
        <h3 className="text-xl font-bold">What is this?</h3>
      </div>
      <p>
        This is a PoliNetwork&apos;s internal tool that allows admins and
        department staff to perform multiple actions via an easy web interface.
      </p>
      <p>
        What actions you can perform depends on your role, but some remarkable
        ones are:
      </p>
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:flex flex-wrap gap-4 py-2">
        <FeatureBox icon={BookOpen} feature="Group list" />
        <FeatureBox icon={Users} feature="User list" />
        <FeatureBox icon={PencilLine} feature="Update homepage" />
        <FeatureBox icon={Gavel} feature="Ban user everywhere" />
        <FeatureBox icon={ClipboardList} feature="Global audit log" />
        <FeatureBox icon={Bot} feature="Manage Telegram bot" />
        <FeatureBox icon={ShieldCheck} feature="Spam bypass message " />
        <FeatureBox icon={LayoutTemplate} feature="Internal assoc tools" />
        <FeatureBox icon={CircleEllipsis} feature="Many others" />
      </div>
        <p className="italic text-xs text-muted-foreground">
          It&apos;s clear that you&apos;ll have access to different features
          depending on your role(s).
        </p>
    </div>
  );
}

export function FeatureBox({
  icon: Icon,
  feature,
}: {
  icon: LucideIcon;
  feature: string;
}) {
  return (
    <Card className="h-36 md:h-28 lg:w-36 w-full">
      <div className="grid h-full grid-cols-1 grid-rows-[1fr_1fr] gap-y-2">
        <Icon size={28} className="place-self-end justify-self-center" />
        <p className="mx-auto max-w-26 text-center text-base md:text-sm">{feature}</p>
      </div>
    </Card>
  );
}
