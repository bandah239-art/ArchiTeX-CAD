using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Geometry;

using System;
using System.Runtime.InteropServices;

namespace Gile.AutoCAD.R25.Geometry
{
    /// <summary>
    /// Enumeration of AutoCAD coordinate systems.
    /// </summary>
    public enum CoordSystem
    {
        /// <summary>
        /// World Coordinate System.
        /// </summary>
        WCS = 0,

        /// <summary>
        /// Current User Coodinate System. 
        /// </summary>
        UCS,

        /// <summary>
        /// Current viewport Display Coordinate System.
        /// </summary>
        DCS,

        /// <summary>
        /// Paper Space Display Coordinate System.
        /// </summary>
        PSDCS
    }

    /// <summary>
    /// Enumeration of the tangent types.
    /// </summary>
    [Flags]
    public enum TangentType
    {
        /// <summary>
        /// Tangents inside two circles.
        /// </summary>
        Inner = 1,

        /// <summary>
        /// Tangents outside two circles.
        /// </summary>
        Outer = 2
    }

    /// <summary>
    /// Provides internal methods.
    /// </summary>
    internal static partial class GeometryExtension
    {
        /// <summary>
        /// Creates a new instance of Polyline resulting from the projection on <c>plane</c>. parallel to <c>direction</c>
        /// </summary>
        /// <param name="pline">Polyline (any type) to project.</param>
        /// <param name="plane">Projection plane..</param>
        /// <param name="direction">Projection direction.</param>
        /// <returns>The projected polyline.</returns>
        /// <exception cref="ArgumentNullException">ArgumentNullException is thrown if <paramref name="pline"/> is null.</exception>
        /// <exception cref="ArgumentNullException">ArgumentNullException is thrown if <paramref name="plane"/> is null.</exception>
        internal static Polyline? ProjectPolyline(Curve pline, Plane plane, Vector3d direction)
        {
            ArgumentNullException.ThrowIfNull(pline);
            ArgumentNullException.ThrowIfNull(plane);
            if (pline is not Polyline && pline is not Polyline2d && pline is not Polyline3d)
                return null;
            using DBObjectCollection oldCol = [];
            using DBObjectCollection newCol = [];
            pline.Explode(oldCol);
            foreach (DBObject obj in oldCol)
            {
                Curve? crv = obj as Curve;
                if (crv != null)
                {
                    Curve flat = crv.GetProjectedCurve(plane, direction);
                    newCol.Add(flat);
                }
                obj.Dispose();
            }
            PolylineSegmentCollection psc = [];
            for (int i = 0; i < newCol.Count; i++)
            {
                if (newCol[i] is Ellipse ellipse)
                {
                    psc.AddRange(new PolylineSegmentCollection(ellipse));
                    continue;
                }
                Curve crv = (Curve)newCol[i];
                Point3d start = crv.StartPoint;
                Point3d end = crv.EndPoint;
                double bulge = 0.0;
                if (crv is Arc arc)
                {
                    double angle = arc.Center.GetVectorTo(start).GetAngleTo(arc.Center.GetVectorTo(end), arc.Normal);
                    bulge = Math.Tan(angle / 4.0);
                }
                psc.Add(new PolylineSegment(start.Convert2d(plane), end.Convert2d(plane), bulge));
            }
            foreach (DBObject o in newCol) o.Dispose();
            Polyline projectedPline = psc.Join(new Tolerance(1e-9, 1e-9))[0].ToPolyline();
            var normal = plane.Normal;
            projectedPline.Normal = normal;
            projectedPline.Elevation =
                plane.PointOnPlane.TransformBy(Matrix3d.WorldToPlane(new Plane(Point3d.Origin, normal))).Z;
            if (!pline.StartPoint.Project(plane, direction).IsEqualTo(projectedPline.StartPoint, new Tolerance(1e-9, 1e-9)))
            {
                projectedPline.Normal = normal.Negate();
                projectedPline.Elevation =
                    plane.PointOnPlane.TransformBy(Matrix3d.WorldToPlane(new Plane(Point3d.Origin, normal))).Z;
            }
            return projectedPline;
        }

        /// <summary>
        /// Creates a new instance of Polyline resulting from the projection of <c>extents</c> MinPoint and MaxPoint.
        /// </summary>
        /// <param name="extents">Extents3d of the transformed polyline from WCS plane to <c>dirplane</c>.</param>
        /// <param name="plane">Projection plane.</param>
        /// <param name="direction">Projection direction.</param>
        /// <param name="dirPlane">Plane which origin is 0, 0, 0 and normal as the polyline.</param>
        /// <returns>The newly created Polyline.</returns>
        /// <exception cref="ArgumentNullException">ArgumentNullException is thrown if <paramref name="plane"/> is null.</exception>
        /// <exception cref="ArgumentNullException">ArgumentNullException is thrown if <paramref name="dirPlane"/> is null.</exception>
        internal static Polyline ProjectExtents(Extents3d extents, Plane plane, Vector3d direction, Plane dirPlane)
        {
            ArgumentNullException.ThrowIfNull(plane);
            ArgumentNullException.ThrowIfNull(dirPlane);
            Point3d pt1 = extents.MinPoint.TransformBy(Matrix3d.PlaneToWorld(dirPlane));
            Point3d pt2 = extents.MaxPoint.TransformBy(Matrix3d.PlaneToWorld(dirPlane));
            Polyline projectedPline = new(2);
            projectedPline.AddVertexAt(0, pt1.Project(plane, direction).Convert2d(), 0.0, 0.0, 0.0);
            projectedPline.AddVertexAt(1, pt2.Project(plane, direction).Convert2d(), 0.0, 0.0, 0.0);
            return projectedPline;
        }

        #region P/Invoke acedTrans
        const int RTSHORT = 5003, RTNORM = 5100;

        [System.Security.SuppressUnmanagedCodeSecurity]
        [LibraryImport("accore.dll", EntryPoint = "acedTrans")]
        [UnmanagedCallConv(CallConvs = new Type[] { typeof(System.Runtime.CompilerServices.CallConvCdecl) })]
        private static partial int acedTrans([In]double[] point, IntPtr fromRb, IntPtr toRb, int disp, [Out]double[] result);

        /// <summary>
        /// Translates a point or a displacement from one coordinate system into another.
        /// </summary>
        /// <param name="coordinateSet">Coordinates of Point3d or Vector3d.</param>
        /// <param name="from">CoordinateSystem to transform from.</param>
        /// <param name="to">CoordinateSystem to transform to.</param>
        /// <param name="disp">If nonzero, pt is treated as a displacement vector; otherwise, it is treated as a point;</param>
        /// <returns>The coordinates of the translated point or vector.</returns>
        /// <exception cref="TransException"></exception>
        public static double[] Trans(double[] coordinateSet, TypedValue from, TypedValue to, int disp)
        {
            static void Validate(TypedValue typedValue1, TypedValue typedValue2)
            {
                if (typedValue1.TypeCode == RTSHORT)
                {
                    int fromValue = (int)typedValue1.Value;
                    if (fromValue < 0 || 3 < fromValue)
                        throw new TransException();
                    if (fromValue == 3 &&
                        (HostApplicationServices.WorkingDatabase.TileMode ||
                        typedValue2.TypeCode != RTSHORT ||
                        (int)typedValue2.Value != 2))
                        throw new TransException();
                }
            }
            Validate(from, to);
            Validate(to, from);
            var result = new double[3];
            if (acedTrans(
                coordinateSet,
                new ResultBuffer(from).UnmanagedObject,
                new ResultBuffer(to).UnmanagedObject,
                disp,
                result) != RTNORM)
                throw new TransException();
            return result;
        }

        class TransException : Exception
        {
            public TransException() : base("Invalid arguments in coordinate transform request.") { }
        }
        #endregion
    }
}
