import {
  createAcknowledgement,
  createAcknowledgementGroup,
  deleteAcknowledgement,
  deleteAcknowledgementGroup,
  getAcknowledgements,
  reorderAcknowledgementGroups,
  reorderAcknowledgements,
  updateAcknowledgement,
  updateAcknowledgementGroup,
} from "@/features/acknowledgements/acknowledgements.functions"
import {
  acknowledgementGroupInput,
  acknowledgementIdInput,
  acknowledgementInput,
  reorderAcknowledgementGroupsInput,
  reorderAcknowledgementsInput,
  updateAcknowledgementGroupInput,
  updateAcknowledgementInput,
} from "@/features/acknowledgements/acknowledgements.validation"

import { destructive, read, write } from "../operation"

/** Web › Riconoscimenti: the website's acknowledgements page. Every change is public at once. */
export const acknowledgementsOperations = [
  read("acknowledgements.page.get", getAcknowledgements, {
    guard: "adminMiddleware",
    description:
      "The acknowledgements page: role groups (website section) with their people, and the projects list, in display order, with their ids.",
  }),
  write("acknowledgements.groups.create", createAcknowledgementGroup, {
    guard: "webContentWriteMiddleware",
    input: acknowledgementGroupInput,
    description:
      "Add a role group to the website section of the public acknowledgements page. An empty group isn't shown.",
  }),
  write("acknowledgements.groups.update", updateAcknowledgementGroup, {
    guard: "webContentWriteMiddleware",
    input: updateAcknowledgementGroupInput,
    description: "Rename a role group or change its icon (id from acknowledgements.page.get) on the public website.",
  }),
  write("acknowledgements.groups.reorder", reorderAcknowledgementGroups, {
    guard: "webContentWriteMiddleware",
    input: reorderAcknowledgementGroupsInput,
    description: "Set the order of the role groups: every group id, in the new order, each once.",
  }),
  destructive("acknowledgements.groups.delete", deleteAcknowledgementGroup, {
    guard: "webContentWriteMiddleware",
    input: acknowledgementIdInput,
    description: "Delete one role group and every person in it from the public acknowledgements page. Can't be undone.",
  }),
  write("acknowledgements.entries.create", createAcknowledgement, {
    guard: "webContentWriteMiddleware",
    input: acknowledgementInput,
    description:
      "Add a person to a role group (list: { section: website, groupId }) or to the projects list (list: { section: projects }); detail is optional.",
  }),
  write("acknowledgements.entries.update", updateAcknowledgement, {
    guard: "webContentWriteMiddleware",
    input: updateAcknowledgementInput,
    description: "Edit a person's name or detail (id from acknowledgements.page.get); an empty detail removes it.",
  }),
  write("acknowledgements.entries.reorder", reorderAcknowledgements, {
    guard: "webContentWriteMiddleware",
    input: reorderAcknowledgementsInput,
    description: "Set the order of the people in one list: every id of that list, in the new order, each once.",
  }),
  destructive("acknowledgements.entries.delete", deleteAcknowledgement, {
    guard: "webContentWriteMiddleware",
    input: acknowledgementIdInput,
    description: "Remove one person from the public acknowledgements page. Can't be undone.",
  }),
]
