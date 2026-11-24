import {
  createGroupLabel,
  createReleaseLabel,
  deleteGroupLabel,
  editGroupLabel,
  groupLabelTagInput,
  listGroupLabels,
  listGroupsForLabels,
  listGroupsWithLabels,
  renameGroupLabel,
  tagGroup,
  untagGroup,
} from "@/features/group-labels/group-labels.functions"
import {
  createGroupLabelInput,
  createReleaseLabelInput,
  editGroupLabelInput,
  groupLabelIdentifierInput,
  renameGroupLabelInput,
} from "@/features/group-labels/group-labels.validation"

import { destructive, read, write } from "../operation"

export const labelsOperations = [
  read("labels.labels.list", listGroupLabels, {
    guard: "adminMiddleware",
    description:
      'Every group label: tags, categories (dotted paths under a root, e.g. "didattica.design") and publications ("release-…"), with color and description.',
  }),
  read("labels.groups.list", listGroupsWithLabels, {
    guard: "adminMiddleware",
    description: "Every Telegram and WhatsApp group with its labels resolved.",
  }),
  read("labels.groups.listByPlatform", listGroupsForLabels, {
    guard: "adminMiddleware",
    description: "The Telegram groups and the WhatsApp groups, as two lists, for picking a group to label.",
  }),
  write("labels.groups.tag", tagGroup, {
    guard: "labelsWriteMiddleware",
    input: groupLabelTagInput,
    description:
      'Add a label to one group (type "tg" or "wa": their ids may collide; ids from labels.groups.list). Labels decide where the public website lists the group.',
  }),
  write("labels.groups.untag", untagGroup, {
    guard: "labelsWriteMiddleware",
    input: groupLabelTagInput,
    description:
      'Remove a label from one group (type "tg" or "wa"). The public website stops listing it under that label.',
  }),
  write("labels.labels.create", createGroupLabel, {
    guard: "labelsWriteMiddleware",
    input: createGroupLabelInput,
    description:
      'Create a tag (no dots), a category root, or a category nested under an existing root, with a #rrggbb color. The "release-" prefix is reserved.',
  }),
  write("labels.publications.create", createReleaseLabel, {
    guard: "labelsWriteMiddleware",
    // The validator turns `name` into `label: "release-<name>"`, which it would refuse on the server function's own
    // parse: pass its input object, so the server function transforms it once.
    input: createReleaseLabelInput.in,
    description:
      'Create a publication label "release-<name>" from its name (without the prefix), color and description.',
  }),
  write("labels.labels.edit", editGroupLabel, {
    guard: "labelsWriteMiddleware",
    input: editGroupLabelInput,
    description: "Change one label's color and description; label names it as listed by labels.labels.list.",
  }),
  write("labels.labels.rename", renameGroupLabel, {
    guard: "labelsWriteMiddleware",
    input: renameGroupLabelInput,
    description:
      "Rename one label to newLabel, also re-pathing every label nested under it; groups keep their labels. Same category root only; publications can't be renamed.",
  }),
  destructive("labels.labels.delete", deleteGroupLabel, {
    guard: "labelsWriteMiddleware",
    input: groupLabelIdentifierInput,
    description:
      "Delete one label: it is removed from every group that uses it, and deleting a category may remove the labels nested under it too. Can't be undone.",
  }),
]
