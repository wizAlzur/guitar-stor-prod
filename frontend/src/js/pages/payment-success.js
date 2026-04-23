import { PaymentResultPage } from "../shared/payment-result-page.js"

new PaymentResultPage({
  kind: "success",
  pageName: "orders",
  pageFile: "payment-success.html"
}).init()
