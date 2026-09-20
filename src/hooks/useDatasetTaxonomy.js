// src/hooks/useDatasetTaxonomy.js
import { useQuery } from "@tanstack/react-query";
import { getTaxonomyForDataset } from "../services/taxonomyApi";

/**
 * Returns the effective sentiment/type options for a dataset.
 * Falls back to built-in defaults when the dataset has no taxonomy.
 *
 * Shape:
 *   {
 *     isLoading: boolean,
 *     sentiment: [{ value, label, order }],
 *     type:      [{ value, label, order }],
 *     values:    { sentiment: string[], type: string[] },   // convenience
 *     taxonomyId, taxonomyName
 *   }
 */
export function useDatasetTaxonomy(datasetId) {
  const { data, isLoading } = useQuery({
    queryKey: ["taxonomy-for-dataset", datasetId],
    queryFn: () => getTaxonomyForDataset(datasetId),
    enabled: !!datasetId,
    staleTime: 5 * 60 * 1000,
  });

  const sentiment = data?.sentiment || [];
  const type = data?.type || [];

  return {
    isLoading,
    sentiment,
    type,
    values: {
      sentiment: sentiment.map((s) => s.value),
      type: type.map((t) => t.value),
    },
    taxonomyId: data?.taxonomyId || null,
    taxonomyName: data?.taxonomyName || "Default",
  };
}
