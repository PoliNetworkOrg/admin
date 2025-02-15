// THIS FILE IS TEMPORARY UNTIL i18n IS PROPER IMPLEMENTED
// HERE ARE IMPLEMENTED SOME FUNCTION THAT ARE USEFUL IN THIS EARLY STAGE
// FOR REPLACING IDS with WORDS

import { BOARD_ROLE, DEP_ROLE, type TDepRole, type TBoardRole } from "@/constants";

const BOARD_ROLE_STRING_EN: Record<TBoardRole, string> = {
  [BOARD_ROLE.PRESIDENT]: "President",
  [BOARD_ROLE.VICE_PRESIDENT]: "Vice President",
  [BOARD_ROLE.SECRETARY]: "Secretary",
  [BOARD_ROLE.TREASURER]: "Treasurer",
  [BOARD_ROLE.MEMBER]: "",
}

export function getBoardRoleString(role: TBoardRole): string {
  return BOARD_ROLE_STRING_EN[role];
}

const DEP_ROLE_STRING_EN: Record<TDepRole, string> = {
  [DEP_ROLE.HEAD]: "Head",
  [DEP_ROLE.DEPUTY_HEAD]: "Deputy Head",
  [DEP_ROLE.MEMBER]: "",
}

export function getDepartmentRoleString(role: TDepRole): string {
  return DEP_ROLE_STRING_EN[role];
}
