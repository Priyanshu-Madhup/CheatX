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

export const addItem = (testId, { kind = "mcq", question, context = "", options = null, choice = null, probabilities = null, code = null }) =>
  supabase
    .from("items")
    .insert({ test_id: testId, kind, question, context, options, choice, probabilities, code })
    .select("*")
    .single()
    .then(unwrap);
