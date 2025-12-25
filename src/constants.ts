export const USER_ROLE = {
  ADMIN_ORG: "owner",
  MEMBER: "member",
  INACTIVE: "inactive",
  DISABLED: "disabled",
} as const
export type TUserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

export const DEPARTMENT_ID = {
  IT: "it",
  SOCIAL: "social",
  HR: "hr",
  INST_RELATIONS: "institutional_relations",
  EVENTS: "events",
} as const
export type TDepartmentId = (typeof DEPARTMENT_ID)[keyof typeof DEPARTMENT_ID]

// department roles
export const DEP_ROLE = {
  HEAD: "head",
  DEPUTY_HEAD: "deputy_head",
  MEMBER: "member",
} as const
export type TDepRole = (typeof DEP_ROLE)[keyof typeof DEP_ROLE]

export const BOARD_ROLE = {
  PRESIDENT: "president",
  VICE_PRESIDENT: "vice_president",
  SECRETARY: "secretary",
  TREASURER: "treasurer",
  MEMBER: "member",
} as const
export type TBoardRole = (typeof BOARD_ROLE)[keyof typeof BOARD_ROLE]

export const INCOMPATIBLE_BOARD_ROLES: TBoardRole[] = [
  BOARD_ROLE.PRESIDENT,
  BOARD_ROLE.VICE_PRESIDENT,
  BOARD_ROLE.SECRETARY,
] as const
