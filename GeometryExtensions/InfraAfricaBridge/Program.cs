namespace InfraAfrica.Bridge;

/// <summary>
/// Stub entry point. Build with AutoCAD ObjectARX references to enable full DWG export.
/// See python/bim/autocad_bridge.py for runtime detection.
/// </summary>
public static class Program
{
    public static int Main(string[] args)
    {
        Console.Error.WriteLine(
            "InfraAfrica AutoCAD bridge stub. To enable native DWG export:\n" +
            "1. Build GeometryExtensionsR25\n" +
            "2. Set ACAD_CORE, ACAD_DB, ACAD_MGD env vars\n" +
            "3. dotnet build InfraAfricaBridge.csproj -c Release\n" +
            "Use Python bim.geometry_extensions API for cross-platform geometry."
        );
        return args.Length > 0 ? 2 : 1;
    }
}
