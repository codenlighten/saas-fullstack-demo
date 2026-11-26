# IP records

| Date | Covers | Type | Record hash | Signer | Tag |
|---|---|---|---|---|---|
| 2026-11-26 | Commit `380dcad`: a Next.js subscriptions demo using Stripe test mode, application code, tests and documentation. No authorship claimed in third-party libraries, create-next-app scaffolding and the generated lockfile. | software, hash-only | [`1affc80c2ab02117af9d03984a9169268a1a4919ac2f0145c3d8dec1dcae69e9`](https://iptrust.org/v/1affc80c2ab02117af9d03984a9169268a1a4919ac2f0145c3d8dec1dcae69e9) | Gregory J. Ward | `ip-2026-11-26` |
| 2026-11-26 | Commit `731e3d1`: a Next.js subscriptions demo using Stripe test mode, application code, tests and documentation; revision with browser tests and a success-page deadline. No authorship claimed in third-party libraries, create-next-app scaffolding and the generated lockfile. | software, hash-only | [`f8c7ba864bcda34767ce485514ec7c10f2163b75d53b6759ee673c29df638c79`](https://iptrust.org/v/f8c7ba864bcda34767ce485514ec7c10f2163b75d53b6759ee673c29df638c79) | Gregory J. Ward | `ip-2026-11-26-2` |

A record is evidence that the committed content existed by the time of its anchor and that the signer made
the statement; it does not create or register any right. Anchoring completes some hours after submission.
Files under `third_party/`, where present, are not part of the record.

## Verifying

The commands below show the first record. For a later one, use its record hash and tag from the table.

Verification needs the evidence package for the record, which the author holds and which is not committed
here. With it in `.iptrust/`:

```
git worktree add /tmp/at-tag-saas-fullstack-demo ip-2026-11-26
cp -r .iptrust /tmp/at-tag-saas-fullstack-demo/
(cd /tmp/at-tag-saas-fullstack-demo && iptrust2 verify 1affc80c2ab02117af9d03984a9169268a1a4919ac2f0145c3d8dec1dcae69e9 --fetch-headers)
git worktree remove --force /tmp/at-tag-saas-fullstack-demo
```

Expect `verdict: valid` and `content: matched` once both chains have anchored.
