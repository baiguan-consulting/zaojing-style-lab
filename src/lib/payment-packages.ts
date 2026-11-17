export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  amountFen: number;
  description: string;
};

export const CREDIT_UNIT_PRICE_FEN = 50;

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "single",
    name: "单次体验",
    credits: 1,
    amountFen: 50,
    description: "生成 1 张图片",
  },
  {
    id: "starter",
    name: "轻量创作包",
    credits: 10,
    amountFen: 500,
    description: "生成 10 张图片",
  },
  {
    id: "standard",
    name: "常用创作包",
    credits: 20,
    amountFen: 1000,
    description: "生成 20 张图片",
  },
  {
    id: "creator",
    name: "批量创作包",
    credits: 50,
    amountFen: 2500,
    description: "生成 50 张图片",
  },
];

export function getCreditPackage(id: string) {
  return CREDIT_PACKAGES.find((item) => item.id === id);
}

export function formatYuan(amountFen: number) {
  return (amountFen / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
