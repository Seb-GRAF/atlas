// Atlas redesign — V2 refined: states + mobile.
const { DesignCanvas, DCSection, DCArtboard } = window;

function AtlasApp() {
  return (
    <DesignCanvas
      title="Atlas — V2 refined: states + mobile"
      subtitle="Map-hero direction pushed further. Desktop states, then iPhone."
      bg="#e8e3da"
      ink="#16140f"
    >
      <DCSection id="desktop" title="Desktop — states">
        <DCArtboard id="v2-default" label="Default" width={1280} height={880}>
          <V2RefinedDesktop />
        </DCArtboard>
        <DCArtboard id="v2-empty" label="Empty / first scan" width={1280} height={880}>
          <V2EmptyState />
        </DCArtboard>
        <DCArtboard id="v2-scan" label="Scanning" width={1280} height={880}>
          <V2ScanningState />
        </DCArtboard>
        <DCArtboard id="v2-settings" label="Settings drawer" width={1280} height={880}>
          <V2DetailDrawer />
        </DCArtboard>
      </DCSection>

      <DCSection id="mobile" title="Mobile — iPhone">
        <DCArtboard id="m-list" label="List (default)" width={390} height={844}>
          <V2MobileList />
        </DCArtboard>
        <DCArtboard id="m-map" label="Map" width={390} height={844}>
          <V2MobileMap />
        </DCArtboard>
        <DCArtboard id="m-detail" label="Detail sheet" width={390} height={844}>
          <V2MobileDetail />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AtlasApp />);
