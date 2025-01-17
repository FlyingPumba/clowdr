import type { Entity, Resolver } from "@urql/exchange-graphcache";
import type { IntrospectionData } from "@urql/exchange-graphcache/dist/types/ast";
import { GraphQLError } from "graphql";
import { satisfiesConditions } from "../conditionals";
import { getObjectTypeName, getTableFieldsSchema } from "../schema";
import type { AugmentedIntrospectionData } from "../types";
import { argumentsAreEqual } from "./arguments";
import { resolveRelation } from "./relation";

export const arrayFieldResolver: (schema: IntrospectionData, augSchema: AugmentedIntrospectionData) => Resolver = (
    schema,
    augSchema
) =>
    function resolver(parent, args, cache, info) {
        const parentTableSchema = getTableFieldsSchema(info.parentTypeName, schema, augSchema);
        if (!parentTableSchema) {
            info.error = new GraphQLError("Parent table schema not found");
            return undefined;
        }
        const fieldSchema = parentTableSchema.tableSchema.fields.find((x) => x.name === info.fieldName);
        if (!fieldSchema) {
            info.error = new GraphQLError("Field schema not found");
            return undefined;
        }
        const whereSchema = fieldSchema.args.find((x) => x.name === "where");
        const boolExpSchemaName = whereSchema?.type.kind === "INPUT_OBJECT" ? whereSchema.type.name : undefined;

        const existingFields = cache.inspectFields(parent as Entity);
        const matchingFields = existingFields.filter((x) => x.fieldName === info.fieldName);
        // console.info(`Existing matching fields for ${info.parentKey}.${info.fieldName}`, { parent, matchingFields });
        const allExistingFieldValues = matchingFields.flatMap((field) =>
            cache.resolve(parent as Entity, field.fieldKey)
        );
        let existingFieldValues = [];
        if (boolExpSchemaName && args.where) {
            for (const value of allExistingFieldValues) {
                const conditionResult =
                    typeof value === "string"
                        ? satisfiesConditions(
                              schema,
                              augSchema,
                              boolExpSchemaName,
                              args.where as any,
                              value,
                              args,
                              cache
                          )
                        : satisfiesConditions(
                              schema,
                              augSchema,
                              boolExpSchemaName,
                              args.where as any,
                              cache.keyOfEntity(value as Entity) as string,
                              args,
                              cache
                          );
                if (conditionResult === "partial") {
                    // console.info(
                    //     `Array field resolver: Setting partial result due to partial conditional: ${info.parentKey}.${info.fieldName}`
                    // );
                    info.partial = true;
                    return undefined;
                }
                if (conditionResult) {
                    existingFieldValues.push(value);
                }
            }
        } else {
            existingFieldValues = allExistingFieldValues;
        }

        const fieldAugSchema = parentTableSchema.augTableSchema.fields.find(
            (x) =>
                (x.type.kind === "ARRAY_RELATIONSHIP_KEY_MAP" || x.type.kind === "OBJECT_RELATIONSHIP_KEY_MAP") &&
                x.name === info.fieldName
        );
        if (
            !fieldAugSchema ||
            !(
                fieldAugSchema.type.kind === "ARRAY_RELATIONSHIP_KEY_MAP" ||
                fieldAugSchema.type.kind === "OBJECT_RELATIONSHIP_KEY_MAP"
            )
        ) {
            info.error = new GraphQLError("Field augmented schema not found");
            return undefined;
        }
        const fieldEntityTypeName = getObjectTypeName(fieldSchema.type);
        if (!fieldEntityTypeName) {
            info.error = new GraphQLError("Field entity type name not found");
            return undefined;
        }

        const results = resolveRelation(fieldAugSchema.type, cache, info.parentKey, fieldEntityTypeName, args.where);
        info.partial =
            info.partial || (results === null && !matchingFields.some((x) => argumentsAreEqual(x.arguments, args)));
        // console.info(`Resolved relational results for ${info.parentKey}.${info.fieldName}`, { parent, results });

        // console.info(`Array field resolver for ${info.parentTypeName}.${info.fieldName}`, {
        //     parent,
        //     args,
        //     info,
        //     parentTableSchema,
        //     fieldSchema,
        //     fieldAugSchema,
        //     fieldEntityTypeName,
        //     matchingFields,
        //     allExistingFieldValues,
        //     existingFieldValues,
        //     results,
        // });
        const finalResults: Set<string | null> = new Set();
        // let resolvedAny = false;
        if (matchingFields.length) {
            const keys = existingFieldValues.map((x) => cache.keyOfEntity(x as Entity));
            keys.map((key) => finalResults.add(key));
            // resolvedAny = true;
        }
        if (results && results[fieldEntityTypeName] && results[fieldEntityTypeName] instanceof Array) {
            const keys = results[fieldEntityTypeName] as string[];
            keys.map((key) => finalResults.add(key));
            // resolvedAny = true;
        }

        // console.log(
        //     `Array resolution for ${info.parentTypeName}.${info.fieldName}: ${resolvedAny ? "" : "No "}final results`,
        //     finalResults
        // );

        // This is not correct. No results for an array field means empty array not partial data.
        // if (!resolvedAny) {
        //     info.partial = true;
        //     return undefined;
        // }

        let arrResults = [...finalResults];

        // TODO: order_by
        // TODO: distinct_on

        if (args.offset) {
            if (typeof args.offset === "number") {
                arrResults = arrResults.slice(args.offset);
            } else {
                info.error = new GraphQLError("Invalid offset value");
                return [];
            }
        }

        if (args.limit) {
            if (typeof args.limit === "number") {
                arrResults = arrResults.slice(0, args.limit);
            } else {
                info.error = new GraphQLError("Invalid limit value");
                return [];
            }
        }

        // console.log(
        //     `Array resolution for ${info.parentTypeName}.${info.fieldName}: Array results after ordering/distinction/offset/limit`,
        //     arrResults
        // );

        return arrResults;
    };
