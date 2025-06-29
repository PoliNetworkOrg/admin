import { Award, Building, Lock, Star, ShieldUser, Gem } from "lucide-react";
import { FeatureBox } from "./what-is";
import { Card } from "@/components/ui/card";
import loginSvg1 from "@/assets/svg/login-1.svg";
import loginSvg2 from "@/assets/svg/login-2.svg";
import loginSvg3 from "@/assets/svg/login-3.svg";
import Image from "next/image";

export function CanIAccess() {
  return (
    <div className="text-foreground w-full">
      <div className="text-primary flex items-center space-x-2 py-2 dark:text-white">
        <Lock size={28} className="" />
        <h3 className="text-xl font-bold">How can I access?</h3>
      </div>
      <p>
        You can access this dashboard if you have at least one of this role:
      </p>
      <div className="xs:grid-cols-2 grid grid-cols-1 flex-wrap gap-4 py-2 md:grid-cols-3 lg:flex">
        <FeatureBox icon={Star} feature="President or Vice President" />
        <FeatureBox icon={Award} feature="Board member" />
        <FeatureBox icon={Building} feature="Department member" />
        <FeatureBox icon={ShieldUser} feature="Groups admin" />
        <FeatureBox icon={Gem} feature="Special roles" />
      </div>
      <br />
      <p>
        When you have checked that you are eligible, these are the steps to
        access:
      </p>
      <div className="grid grid-rows-3 py-2 max-lg:space-y-4 lg:flex lg:space-x-4">
        <Card className="flex-1 p-4">
          <div className="grid h-full w-full grid-cols-1 grid-rows-[2fr_1fr] gap-y-4">
            <Image
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              src={loginSvg1}
              width={200}
              alt="insert credentials"
              className="place-self-center justify-self-center"
            />
            <div className="text-center">
              <p className="text-primary text-xl font-bold dark:text-white">
                1. Login with GitHub
              </p>
              <p className="text-muted-foreground text-xs">
                (provider might change)
              </p>
            </div>
          </div>
        </Card>
        <Card className="flex-1 p-4">
          <div className="grid h-full w-full grid-cols-1 grid-rows-[2fr_1fr] gap-y-4">
            <Image
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              src={loginSvg2}
              width={200}
              alt="insert credentials"
              className="place-self-center justify-self-center"
            />
            <div className="text-center">
              <p className="text-primary text-lg font-bold dark:text-white">
                2. Link your Telegram account
              </p>
              <p className="text-muted-foreground text-sm">
                This allows to verify your role
              </p>
            </div>
          </div>
        </Card>
        <Card className="flex-1 p-4">
          <div className="grid h-full w-full grid-cols-1 grid-rows-[2fr_1fr] gap-y-4">
            <Image
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              src={loginSvg3}
              width={200}
              alt="insert credentials"
              className="place-self-center justify-self-center"
            />
            <div className="text-center">
              <p className="text-primary text-xl font-bold dark:text-white">
                3. Use the dashboard
              </p>
              <p className="text-muted-foreground text-sm">
                If your role is not recognized, <br /> be patient until the IT team
                fixes it!
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
