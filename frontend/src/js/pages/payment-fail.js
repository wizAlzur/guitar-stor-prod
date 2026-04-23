import { PaymentResultPage } from "../shared/payment-result-page.js"

new PaymentResultPage({
  kind: "fail",
  pageName: "cart",
  pageFile: "payment-fail.html"
}).init()
