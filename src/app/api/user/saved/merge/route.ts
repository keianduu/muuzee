import { mergeSavedRefs } from "@/lib/user/service";
import { createMergeSavedPost } from "./handler";

export const POST = createMergeSavedPost(mergeSavedRefs);
