import type z from "zod";

export const validate = <T>(schema:z.ZodType<T>) => (data:unknown): T =>{
    const result = schema.safeParse(data);

    if (!result.success){
        throw result.error;
    }
    return result.data
}