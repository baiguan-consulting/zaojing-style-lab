import { CreatorShell } from "@/components/creator-shell";

export default function CreatorTermsPage() {
  return <CreatorShell active="terms"><header className="creator-page-header"><div><span className="creator-kicker">CREATOR RULES</span><h1>创作者规则</h1><p>首版规则用于保护创作者、普通用户和平台的共同权益。</p></div></header><article className="creator-terms-page"><section><b>01</b><div><h2>内容与权利</h2><p>投稿者必须拥有提示词和案例图片的发布、展示与商业使用权。不得提交侵权图片、账号水印、未经授权的品牌元素或违法内容。</p></div></section><section><b>02</b><div><h2>审核与发布</h2><p>所有模板均由管理员人工审核。审核通过后才会公开；平台可因质量、权利或安全风险驳回、暂停或下架模板。</p></div></section><section><b>03</b><div><h2>收益条件</h2><p>其他用户成功生成并完成次数核销后，按成功交付图片数量奖励 ¥0.20/张。创作者本人使用自己的模板不产生收益，失败任务和平台免费赠送次数不产生现金收益。</p></div></section><section><b>04</b><div><h2>结算与提现</h2><p>奖励先进入 7 天待结算期，之后可按 ¥0.50 = 1 次兑换平台奖励次数。人工提现最低 ¥50，提交后冻结金额，由管理员审核并通过支付宝转账。</p></div></section><section><b>05</b><div><h2>用户隐私</h2><p>用户上传图片和生成结果只保留 24 小时。创作者只能查看模板和收益汇总，不能查看或下载任何用户素材。</p></div></section></article></CreatorShell>;
}
