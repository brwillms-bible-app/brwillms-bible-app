import { EsvNotice } from "@/components/EsvNotice";

export default function CopyrightPage() {
  return (
    <div className="card prose">
      <h1>Copyright &amp; Terms</h1>
      <h2>Scripture</h2>
      <p>
        By default this site uses the <strong>Berean Standard Bible (BSB)</strong>, which has been dedicated to the
        public domain (BereanBible.com). The current build ships a stub with Genesis 12:1-9 only.
      </p>
      <h3>When the optional ESV provider is enabled</h3>
      <EsvNotice />
      <p>
        Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a
        publishing ministry of Good News Publishers. Used by permission. All rights reserved. The ESV text may not be
        quoted in any publication made available to the public by a Creative Commons license. The ESV may not be
        translated into any other language.
      </p>
      <p>
        Users may not copy or download more than 500 verses of the ESV Bible or more than one half of any book of the
        ESV Bible.
      </p>
      <p>
        Scripture text and audio are requested live from the{" "}
        <a href="https://api.esv.org" target="_blank" rel="noopener noreferrer">
          ESV API
        </a>{" "}
        each time you open a scene, and are never stored by this site. Each request is limited to fewer than 500 verses
        and less than half of any book.
      </p>
      <h2>Artwork, intros, and maps</h2>
      <p>
        Illustrations, book introductions, map panels, and timing cues are original works of this project and are kept
        separate from the ESV text.
      </p>
      <h2>Non-commercial</h2>
      <p>This site is free for everyone. It has no paywalls, subscriptions, advertising, sponsorships, or donation requests.</p>
    </div>
  );
}
