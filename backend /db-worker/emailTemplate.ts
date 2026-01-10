export function closeTradeEmailHTML(asset:string,pnl:string,type:string,openingPrice:string,margin:string,action:string,leverage:string,closePrice:string,orderId:string,pnl_color:string) {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>Trade Closed - Flux Trade</title>
    
    <!-- Google Web Fonts -->
    <link href="https://fonts.googleapis.com/css?family=Inter:400,600,700&display=swap" rel="stylesheet">
    
    <style>
        /* RESET STYLES */
        html, body { margin: 0 auto !important; padding: 0 !important; height: 100% !important; width: 100% !important; font-family: 'Inter', sans-serif; background-color: #f4f6f8; }
        * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
        div[style*="margin: 16px 0"] { margin: 0 !important; }
        table, td { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; border-collapse: collapse; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        a { text-decoration: none; }
        
        /* DARK MODE SUPPORT */
        @media (prefers-color-scheme: dark) {
            .body-bg { background-color: #0f172a !important; }
            .card-bg { background-color: #1e293b !important; border: 1px solid #334155 !important; }
            .text-main { color: #f8fafc !important; }
            .text-sub { color: #94a3b8 !important; }
            .divider { border-color: #334155 !important; }
            .highlight-bg { background-color: #334155 !important; color: #e2e8f0 !important; }
            .brand-text { color: #f8fafc !important; }
        }

        /* MOBILE RESPONSIVENESS */
        @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; margin: auto !important; }
            .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; padding-right: 0 !important; padding-left: 0 !important; }
            .mobile-padding { padding: 20px !important; }
            /* Adjust alignment for stacked view */
            .data-row td { display: flex !important; justify-content: space-between !important; width: 100% !important; padding-bottom: 15px !important; box-sizing: border-box !important; }
            .data-row td.label { text-align: left !important; }
            .data-row td.value { text-align: right !important; padding-bottom: 15px !important; }
        }
    </style>
</head>

<body width="100%" class="body-bg" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #f4f6f8;">
    <center style="width: 100%; background-color: #f4f6f8;" class="body-bg">
        <div style="display: none; font-size: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
            Trade Closed: ${escapeHTML(asset)} PnL: ${escapeHTML(pnl)} USD.
            &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
        </div>

        <!-- GHOST TABLE FOR OUTLOOK DESKTOP WIDTH FIX -->
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->

        <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: auto;" class="email-container">
            <!-- BRANDING HEADER -->
            <tr>
                <td style="padding: 40px 0 25px 0; text-align: center;">
                    <!-- FLUX TRADE BRANDING -->
                    <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                            <td style="padding-right: 12px;">
                            </td>
                            <td class="brand-text" style="font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 700; color: #1e293b; letter-spacing: -0.5px;">
                                Flux Trade
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- MAIN CARD -->
            <tr>
                <td class="card-bg mobile-padding" style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        
                        <!-- HEADLINE -->
                        <tr>
                            <td class="text-main" style="font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 600; color: #1e293b; text-align: center; padding-bottom: 8px;">
                                Order Closed
                            </td>
                        </tr>
                        <tr>
                            <td class="text-sub" style="font-family: 'Inter', sans-serif; font-size: 14px; color: #64748b; text-align: center; padding-bottom: 30px;">
                                Your ${escapeHTML(type)} position on ${escapeHTML(asset)} has been closed.
                            </td>
                        </tr>

                        <!-- PNL HERO SECTION -->
                        <tr>
                            <td style="text-align: center; padding-bottom: 30px;">
                                <div style="display: inline-block; background-color: #f8fafc; border-radius: 8px; padding: 15px 40px; border: 1px solid #e2e8f0; width: 60%; min-width: 200px;" class="card-bg divider">
                                    <span class="text-sub" style="display: block; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Realized PnL</span>
                                    <span style="display: block; font-family: 'Inter', sans-serif; font-size: 32px; font-weight: 700; color: ${pnl_color};">
                                        ${escapeHTML(pnl)} USD
                                    </span>
                                </div>
                            </td>
                        </tr>

                        <!-- DETAILS GRID -->
                        <tr>
                            <td style="border-top: 1px solid #e2e8f0; padding-top: 30px;" class="divider">
                                <!-- Using Font-Size 0 Trick for Inline Block Alignment -->
                                <div style="font-size: 0; text-align: left; width: 100%;">
                                    
                                    <!-- LEFT COLUMN -->
                                    <div class="stack-column" style="display: inline-block; width: 50%; vertical-align: top; font-size: 14px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr class="data-row">
                                                <td class="label text-sub" style="width: 40%; font-family: 'Inter', sans-serif; font-size: 12px; color: #64748b; padding-bottom: 20px;">Pair</td>
                                                <td class="value text-main" style="width: 60%; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #1e293b; padding-bottom: 20px; text-align: right;">${escapeHTML(asset)}</td>
                                            </tr>
                                            <tr class="data-row">
                                                <td class="label text-sub" style="width: 40%; font-family: 'Inter', sans-serif; font-size: 12px; color: #64748b; padding-bottom: 20px;">Entry Price</td>
                                                <td class="value text-main" style="width: 60%; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #1e293b; padding-bottom: 20px; text-align: right;">$${escapeHTML(openingPrice)}</td>
                                            </tr>
                                            <tr class="data-row">
                                                <td class="label text-sub" style="width: 40%; font-family: 'Inter', sans-serif; font-size: 12px; color: #64748b; padding-bottom: 20px;">Margin</td>
                                                <td class="value text-main" style="width: 60%; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #1e293b; padding-bottom: 20px; text-align: right;">$${escapeHTML(margin)}</td>
                                            </tr>
                                            <tr class="data-row">
                                                <td class="label text-sub" style="width: 40%; font-family: 'Inter', sans-serif; font-size: 12px; color: #64748b; padding-bottom: 20px;">Action</td>
                                                <td class="value" style="width: 60%; padding-bottom: 20px; text-align: right;">
                                                    <span class="highlight-bg" style="font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 700; background-color: #e0f2fe; color: #0284c7; padding: 4px 8px; border-radius: 4px;">${escapeHTML(action)}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                                    
                                    <!-- RIGHT COLUMN -->
                                    <!--[if mso]></td><td valign="top" width="50%"><![endif]-->
                                    <div class="stack-column" style="display: inline-block; width: 50%; vertical-align: top; font-size: 14px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr class="data-row">
                                                <td class="label text-sub" style="width: 40%; font-family: 'Inter', sans-serif; font-size: 12px; color: #64748b; padding-bottom: 20px;">Leverage</td>
                                                <td class="value text-main" style="width: 60%; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #1e293b; padding-bottom: 20px; text-align: right;">${escapeHTML(leverage)}x</td>
                                            </tr>
                                            <tr class="data-row">
                                                <td class="label text-sub" style="width: 40%; font-family: 'Inter', sans-serif; font-size: 12px; color: #64748b; padding-bottom: 20px;">Close Price</td>
                                                <td class="value text-main" style="width: 60%; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #1e293b; padding-bottom: 20px; text-align: right;">$${escapeHTML(closePrice)}</td>
                                            </tr>
                                            <tr class="data-row">
                                                <td class="label text-sub" style="width: 40%; font-family: 'Inter', sans-serif; font-size: 12px; color: #64748b; padding-bottom: 20px;">Order ID</td>
                                                <td class="value text-main" style="width: 60%; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #1e293b; padding-bottom: 20px; text-align: right;">#${escapeHTML(orderId)}</td>
                                            </tr>
                                        </table>
                                    </div>

                                </div>
                            </td>
                        </tr>

                        <!-- CTA BUTTON -->
                        <tr>
                            <td style="padding-top: 10px; text-align: center;">
                                <a href="https://fluxtrade.io/history/${escapeHTML(orderId)}" style="background-color: #3b82f6; border-radius: 6px; color: #ffffff; display: block; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; line-height: 48px; text-align: center; text-decoration: none; width: 100%; -webkit-text-size-adjust: none;">View Transaction Details</a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- FOOTER -->
            <tr>
                <td style="padding: 30px; text-align: center;">
                    <p style="margin: 0 0 10px 0; font-family: 'Inter', sans-serif; font-size: 12px; color: #94a3b8;">
                        &copy; 2026 Flux Trade. All rights reserved.
                    </p>
                    <p style="margin: 0; font-family: 'Inter', sans-serif; font-size: 11px; color: #cbd5e1; line-height: 1.5;">
                        This is an automated notification from Flux Trade. Please do not reply to this email.
                    </p>
                </td>
            </tr>
        </table>
        
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
    </center>
</body>
</html>

  `;
}

function escapeHTML(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]!));
}