---
name: recipe-scaler
description: Scale a recipe to a different number of servings, convert units if asked, and keep the method consistent.
category: productivity
---

# Recipe scaler

1. Read the original servings and the target servings. Factor = target / original.
2. Multiply every ingredient amount by the factor. Round to kitchen-friendly amounts (1/4, 1/3, 1/2 or whole units; grams to the nearest 5).
3. Do not scale salt, spices, baking powder and yeast fully above 2x: scale them by about 75% of the factor and say so.
4. Convert units only if asked (cups <-> grams depends on the ingredient: state the assumption).
5. Mention pan size and cooking time changes (bigger batches may need a larger pan or extra time).
6. Output the scaled ingredient list, then any method changes.
