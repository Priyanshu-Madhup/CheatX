import { supabase } from "./supabase.js";

const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

// user_id is filled by the column default (auth.uid()) and enforced by RLS.
export const listTests = () =>
  supabase.from("tests").select("id,title,created_at").order("created_at", { ascending: false }).then(unwrap);

export const createTest = (title) => supabase.from("tests").insert({ title }).select("id,title,created_at").single().then(unwrap);

export const deleteTest = (id) => supabase.from("tests").delete().eq("id", id).then(unwrap);

export const listItems = (testId) =>
  supabase.from("items").select("*").eq("test_id", testId).order("created_at", { ascending: true }).then(unwrap);

export const addItem = (testId, { question, context, options, choice, probabilities }) =>
  supabase
    .from("items")
    .insert({ test_id: testId, question, context, options, choice, probabilities })
    .select("*")
    .single()
    .then(unwrap);
