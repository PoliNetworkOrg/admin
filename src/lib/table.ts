import { createTableHook, stockFeatures } from "@tanstack/react-table"

// One v9 table factory keeps the feature set and column-helper types consistent
// across every data table in the dashboard.
export const { useAppTable, createAppColumnHelper } = createTableHook({
  features: stockFeatures,
})
