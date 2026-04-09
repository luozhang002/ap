import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROUNDS = 10;

/** 开发环境默认口令，上线后请改为注册/重置流程 */
const PLAINTEXT = {
  admin: "Admin123456",
  employee: "User123456",
} as const;

async function main() {
  await prisma.user.deleteMany();

  const adminHash = await bcrypt.hash(PLAINTEXT.admin, ROUNDS);
  const empHash = await bcrypt.hash(PLAINTEXT.employee, ROUNDS);

  await prisma.user.createMany({
    data: [
      { username: "admin", name: "系统管理员", password: adminHash, role: Role.ADMIN },
      { username: "zhangsan", name: "张三", password: empHash, role: Role.EMPLOYEE },
      { username: "lisi", name: "李四", password: empHash, role: Role.EMPLOYEE },
      { username: "wangwu", name: "王五", password: empHash, role: Role.EMPLOYEE },
    ],
  });

  console.log("已插入 1 名管理员、3 名普通员工。");
  console.log("管理员: username=admin, 密码=", PLAINTEXT.admin);
  console.log("员工: username=zhangsan|lisi|wangwu, 密码=", PLAINTEXT.employee);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
