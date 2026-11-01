<script lang="ts">
import type { CollectionEntry } from "astro:content";
import Button from "@components/atoms/action/Button.svelte";
import Icon from "@components/atoms/display/Icon.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { showSnackbar } from "@utils/snackbar";
import { onMount, tick } from "svelte";

let {
	data,
	hasComments = false,
}: {
	data: NonNullable<CollectionEntry<"spec">["data"]["friendExchange"]>;
	hasComments?: boolean;
} = $props();

let ready = $state(false);
let copied = $state("");
let manualCopy = $state("");
let manualField = $state<HTMLTextAreaElement>();
let copyTimer: ReturnType<typeof setTimeout> | undefined;
const completeCard = $derived(
	data.fields.map(({ label, value }) => `${label}：${value}`).join("\n"),
);

async function copy(value: string, key: string) {
	try {
		await navigator.clipboard.writeText(value);
		manualCopy = "";
		copied = key;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = ""), 2000);
		showSnackbar(i18n(I18nKey.copySuccess));
	} catch {
		// 浏览器拒绝剪贴板权限时，仍提供可选择的完整文本。
		manualCopy = value;
		await tick();
		manualField?.focus();
		manualField?.select();
		showSnackbar(i18n(I18nKey.copyFailed));
	}
}

onMount(() => {
	ready = true;
	return () => clearTimeout(copyTimer);
});
</script>

<div class="friend-exchange">
	<div class="friend-exchange__columns">
		<section class="friend-exchange__panel" aria-labelledby="site-card">
			<h2 id="site-card" class="friend-exchange__heading">
				<Icon icon="material-symbols:badge-outline-rounded" aria-hidden="true" />
				{data.cardTitle}
			</h2>
			<div class="friend-exchange__identity">
				<img src={data.avatar} alt={data.avatarAlt} width="64" height="64" loading="lazy" />
				<div>
					<p class="friend-exchange__name">{data.name}</p>
					<p class="friend-exchange__author">{data.author}</p>
				</div>
			</div>
			<p class="friend-exchange__tagline">{data.description}</p>
			<dl class="friend-exchange__fields">
				{#each data.fields as field, index}
					<div class="friend-exchange__field">
						<dt>{field.label}</dt>
						<dd>
							{field.value}
							<button
								type="button"
								class="friend-exchange__copy m3-state-layer"
								aria-label={`${data.copyLabel}${field.label}`}
								title={`${data.copyLabel}${field.label}`}
								disabled={!ready}
								onclick={() => copy(field.value, `field-${index}`)}
							>
								<Icon icon={copied === `field-${index}` ? "material-symbols:check-rounded" : "material-symbols:content-copy-outline-rounded"} aria-hidden="true" />
							</button>
						</dd>
					</div>
				{/each}
			</dl>
			<Button
				label={data.copyAllLabel}
				icon={copied === "all" ? "material-symbols:check-rounded" : "material-symbols:content-copy-outline-rounded"}
				variant="tonal"
				full
				disabled={!ready}
				onclick={() => copy(completeCard, "all")}
			/>
		</section>

		<section class="friend-exchange__panel" aria-labelledby="exchange">
			<h2 id="exchange" class="friend-exchange__heading">
				<Icon icon="material-symbols:handshake-outline-rounded" aria-hidden="true" />
				{data.applicationTitle}
			</h2>
			<p class="friend-exchange__intro">{data.applicationIntro}</p>
			<ol class="friend-exchange__steps">
				{#each data.steps as step, index}
					<li>
						<span class="friend-exchange__number" aria-hidden="true">{index + 1}</span>
						<div>
							<h3>{step.title}</h3>
							<p>{step.description}</p>
						</div>
					</li>
				{/each}
			</ol>
			<details class="friend-exchange__template">
				<summary>{data.templatePreviewLabel}</summary>
				<pre>{data.template.trim()}</pre>
			</details>
			<div class="friend-exchange__actions">
				<Button
					label={data.templateLabel}
					icon={copied === "template" ? "material-symbols:check-rounded" : "material-symbols:content-copy-outline-rounded"}
					variant="outlined"
					full
					disabled={!ready}
					onclick={() => copy(data.template.trim(), "template")}
				/>
				{#if hasComments}
					<Button label={data.commentLabel} icon="material-symbols:chat-bubble-outline-rounded" href="#comments" full />
				{/if}
			</div>
			<p class="friend-exchange__privacy">{data.privacyNote}</p>
		</section>
	</div>

	<section class="friend-exchange__panel friend-exchange__notes" aria-labelledby="exchange-notes">
		<h2 id="exchange-notes" class="friend-exchange__heading">
			<Icon icon="material-symbols:info-outline-rounded" aria-hidden="true" />
			{data.notesTitle}
		</h2>
		<ul>
			{#each data.notes as note}
				<li>
					<h3>{note.title}</h3>
					<p>{note.description}</p>
				</li>
			{/each}
		</ul>
	</section>
	{#if manualCopy}
		<label class="friend-exchange__manual">
			{data.manualCopyLabel}
			<textarea bind:this={manualField} value={manualCopy} readonly rows="7"></textarea>
		</label>
	{/if}
</div>

<style lang="stylus">
@import "../../styles/breakpoints.styl"

.friend-exchange
	container-type: inline-size
	margin-top: var(--m3e-space-4)
	color: var(--on-surface)

	&__columns
		display: grid
		grid-template-columns: minmax(0, 1fr)
		gap: var(--m3e-space-4)

	&__panel
		min-width: 0
		padding: var(--m3e-space-6)
		background: var(--card-bg)
		border-radius: var(--shape-corner-l)

	&__heading
		display: flex
		align-items: center
		gap: var(--m3e-space-3)
		margin: 0 0 var(--m3e-space-5)
		font: var(--m3e-type-title-large)
		scroll-margin-top: 6rem
		> :global(svg)
			width: 1.5rem
			height: 1.5rem
			color: var(--primary)
			flex-shrink: 0

	&__identity
		display: flex
		align-items: center
		gap: var(--m3e-space-4)
		img
			flex-shrink: 0
			border-radius: var(--shape-corner-l)

	&__name
		margin: 0
		font: var(--m3e-type-title-large)

	&__author
		margin: var(--m3e-space-1) 0 0
		font: var(--m3e-type-body-small)
		color: var(--on-surface-variant)

	&__tagline, &__intro, &__privacy
		font: var(--m3e-type-body-medium)
		line-height: 1.7
		color: var(--on-surface-variant)

	&__tagline
		margin: var(--m3e-space-4) 0 var(--m3e-space-5)

	&__intro
		margin: 0 0 var(--m3e-space-6)

	&__fields
		margin: 0 0 var(--m3e-space-5)

	&__field
		position: relative
		min-height: 4rem
		padding: var(--m3e-space-3) 3.5rem var(--m3e-space-3) 0
		border-top: 1px solid var(--outline-variant)
		dt
			font: var(--m3e-type-label-small)
			color: var(--on-surface-variant)
		dd
			margin: var(--m3e-space-1) 0 0
			font: var(--m3e-type-body-small)
			line-height: 1.6
			overflow-wrap: anywhere
			user-select: text

	&__copy
		position: absolute
		right: 0
		top: 50%
		transform: translateY(-50%)
		display: inline-flex
		align-items: center
		justify-content: center
		flex-shrink: 0
		width: 3rem
		height: 3rem
		border: none
		border-radius: var(--shape-corner-m)
		background: transparent
		color: var(--primary)
		cursor: pointer
		> :global(svg)
			width: 1.125rem
			height: 1.125rem

	&__steps
		list-style: none
		padding: 0
		margin: 0 0 var(--m3e-space-6)
		li
			display: grid
			grid-template-columns: 2rem minmax(0, 1fr)
			gap: var(--m3e-space-3)
			+ li
				margin-top: var(--m3e-space-6)

	&__steps h3, &__notes h3
		margin: var(--m3e-space-1) 0 var(--m3e-space-2)
		font: var(--m3e-type-title-small)

	&__steps p, &__notes p
		margin: 0
		font: var(--m3e-type-body-medium)
		line-height: 1.8
		color: var(--on-surface-variant)

	&__number
		display: inline-flex
		align-items: center
		justify-content: center
		width: 2rem
		height: 2rem
		background: var(--secondary-container)
		color: var(--on-secondary-container)
		border-radius: var(--shape-corner-full)
		font: var(--m3e-type-label-large)

	&__template
		margin: 0 0 var(--m3e-space-4)
		font: var(--m3e-type-body-small)
		summary
			display: list-item
			padding: var(--m3e-space-3) 0
			color: var(--primary)
			cursor: pointer
		pre
			margin: var(--m3e-space-2) 0 0
			padding: var(--m3e-space-4)
			background: var(--surface-container)
			border-radius: var(--shape-corner-m)
			font: var(--m3e-type-body-small)
			line-height: 1.8
			white-space: pre-wrap
			overflow-wrap: anywhere

	&__actions
		display: grid
		gap: var(--m3e-space-3)

	:global(.m3-button)
		min-height: 3rem

	&__privacy
		margin: var(--m3e-space-4) 0 0
		font: var(--m3e-type-body-small)
		line-height: 1.7

	&__notes
		margin-top: var(--m3e-space-4)
		ul
			display: grid
			gap: var(--m3e-space-5)
			list-style: none
			padding: 0
			margin: 0

	&__manual
		display: block
		margin-top: var(--m3e-space-4)
		font: var(--m3e-type-body-medium)
		textarea
			display: block
			width: 100%
			margin-top: var(--m3e-space-2)
			padding: var(--m3e-space-4)
			border: 1px solid var(--outline)
			border-radius: var(--shape-corner-m)
			background: var(--surface-container)
			color: var(--on-surface)

/* Stylus 的容器查询需显式插值，避免把变量名原样输出到 CSS。 */
@container {s("(min-width: %s)", bp-sm)}
	.friend-exchange__columns
		grid-template-columns: repeat(2, minmax(0, 1fr))
	.friend-exchange__notes ul
		grid-template-columns: repeat(3, minmax(0, 1fr))

@container {s("(max-width: %s)", bp-sm - 1px)}
	.friend-exchange__panel
		padding: var(--m3e-space-5) var(--m3e-space-4)
</style>
