import {
  createWhatsappGroup,
  deleteWhatsappGroup,
  editWhatsappGroup,
  editWhatsappGroupInput,
  getWhatsappGroups,
  setWhatsappGroupVisibility,
  whatsappGroupIdInput,
  whatsappGroupInput,
  whatsappGroupVisibilityInput,
} from "@/features/whatsapp/groups.functions"

import { destructive, read, write } from "../operation"

export const whatsappOperations = [
  read("whatsapp.groups.list", getWhatsappGroups, {
    guard: "adminMiddleware",
    description: "List the WhatsApp groups, hidden ones included.",
  }),
  write("whatsapp.groups.create", createWhatsappGroup, {
    guard: "whatsappGroupsWriteMiddleware",
    input: whatsappGroupInput,
    description: "Add a WhatsApp group with its chat.whatsapp.com invite link.",
  }),
  write("whatsapp.groups.edit", editWhatsappGroup, {
    guard: "whatsappGroupsWriteMiddleware",
    input: editWhatsappGroupInput,
    description: "Edit one WhatsApp group's title, invite link or visibility.",
  }),
  write("whatsapp.groups.setVisibility", setWhatsappGroupVisibility, {
    guard: "whatsappGroupsWriteMiddleware",
    input: whatsappGroupVisibilityInput,
    description: "Hide one WhatsApp group from the website, or show it again.",
  }),
  destructive("whatsapp.groups.delete", deleteWhatsappGroup, {
    guard: "whatsappGroupsWriteMiddleware",
    input: whatsappGroupIdInput,
    description: "Delete one WhatsApp group.",
  }),
]
