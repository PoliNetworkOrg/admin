import { getSession } from "@/lib/auth";

export const getServerSession = async () => {
  const session = await getSession({
    fetchOptions: {
      //headers: await headers(),
    },
  });
  // console.log(session);
  return session;
};
